import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Proposal, Utterance } from '@dextra/core'
import { Db } from '../src/db'
import { ServiceError } from '../src/errors'
import type { Amendment, Extractor } from '../src/extract'
import { createApp } from '../src/http'
import { Hub } from '../src/hub'
import { AgreementService, applyAmendment, matchContact, type Messenger } from '../src/service'
import type { Transcriber } from '../src/stt'

/**
 * Real SQLite (libSQL, in memory) + real service logic. Only the paid external boundaries are replaced:
 * the LLM proposer is scripted and Telegram calls are recorded instead of sent.
 */
const WEARER = 100
const OMAR = 200
const OMAR_CHAT = 9200
const SARA = 300
const SARA_CHAT = 9300

const utterances: Utterance[] = [
  { speaker: 0, start: 0, end: 3, text: 'So you send me the deck by Friday?', rms: 0.32 },
  { speaker: 1, start: 3, end: 6, text: 'Yes, the deck by Friday. And you intro me to Sara?', rms: 0.08 },
  { speaker: 0, start: 6, end: 8, text: "Deal, I'll intro you to Sara.", rms: 0.3 },
]

const proposal: Proposal = {
  counterpartyName: 'Omar',
  commitments: [
    { speaker: 1, what: 'send the deck', due_text: 'Friday', quote: 'the deck by Friday' },
    { speaker: 0, what: 'intro to Sara', quote: "I'll intro you to Sara" },
    { speaker: 1, what: 'pay $5,000', amount: '$5,000', quote: 'I will pay five thousand' },
  ],
}

class ScriptedExtractor implements Extractor {
  amendment: Amendment = { changes: [{ index: 0, due_text: 'Monday' }] }
  async propose(): Promise<Proposal> {
    return proposal
  }
  async amend(): Promise<Amendment> {
    return this.amendment
  }
}

class RecordingMessenger implements Messenger {
  cards: { chatId: number; businessConnectionId: string; reviewUrl: string }[] = []
  checklists: { businessConnectionId: string; chatId: number; title: string; tasks: string[] }[] = []
  texts: { businessConnectionId: string; chatId: number; text: string }[] = []
  failChecklist = false
  failCard = false
  async sendAgreementCard(p: { businessConnectionId: string; chatId: number; reviewUrl: string }) {
    await new Promise(r => setTimeout(r, 5)) // a real network call takes time; lets concurrent taps interleave
    if (this.failCard) throw new Error('telegram 403')
    this.cards.push({ chatId: p.chatId, businessConnectionId: p.businessConnectionId, reviewUrl: p.reviewUrl })
  }
  async postChecklist(p: { businessConnectionId: string; chatId: number; title: string; tasks: string[] }) {
    if (this.failChecklist) throw new Error('telegram 400')
    this.checklists.push(p)
    return { messageId: 555 }
  }
  async postText(p: { businessConnectionId: string; chatId: number; text: string }) {
    this.texts.push(p)
  }
  async notify() {}
}

const transcriber: Transcriber = { transcribe: async () => utterances }

let db: Db
let hub: Hub
let messenger: RecordingMessenger
let extractor: ScriptedExtractor
let service: AgreementService
let deviceId: string
const fixedNow = () => new Date('2026-11-24T10:00:00.000Z') // Tuesday

async function pairWearer(): Promise<void> {
  const { code } = await service.issuePairCode(deviceId)
  expect(await service.redeemPairCode(code.toLowerCase(), WEARER, 'Yoma')).toBe('ok')
}

async function connectBusiness(): Promise<void> {
  await db.setBusinessConnection(WEARER, 'bc_1', true, true, fixedNow().toISOString())
  await db.upsertContact(WEARER, { tg_id: OMAR, chat_id: OMAR_CHAT, name: 'Omar Haddad', last_incoming_at: '2026-11-24T09:59:00.000Z' })
}

async function sentAgreement(): Promise<string> {
  await connectBusiness()
  const { agreement } = await service.captureUtterances(deviceId, utterances)
  await service.send(deviceId, agreement.id)
  return agreement.id
}

beforeEach(async () => {
  db = await Db.memory()
  hub = new Hub()
  messenger = new RecordingMessenger()
  extractor = new ScriptedExtractor()
  service = new AgreementService({ db, hub, transcriber, extractor, messenger, botUsername: 'DextraBot', now: fixedNow })
  deviceId = (await service.registerDevice()).deviceId
})

afterEach(() => db.close())

describe('device auth and pairing', () => {
  it('rejects unknown tokens', async () => {
    await expect(service.authenticate('nope')).rejects.toThrow(ServiceError)
  })

  it('pairs once; codes are single-use; a paired device cannot be re-bound', async () => {
    const events: string[] = []
    hub.subscribe(deviceId, e => events.push(e.type))
    const { code } = await service.issuePairCode(deviceId)
    expect(code).toMatch(/^[A-Z2-9]{8}$/)
    expect(await service.redeemPairCode(code, WEARER, 'Yoma')).toBe('ok')
    expect(await service.redeemPairCode(code, 999, 'Mallory')).toBe('invalid')
    await expect(service.issuePairCode(deviceId)).rejects.toThrow(/already linked/)
    expect(await service.deviceState(deviceId)).toMatchObject({ paired: true, wearerName: 'Yoma', businessConnected: false })
    expect(events).toEqual(['paired'])
  })

  it('caps the number of linked devices per Telegram account', async () => {
    for (let i = 0; i < 3; i++) {
      const d = (await service.registerDevice()).deviceId
      expect(await service.redeemPairCode((await service.issuePairCode(d)).code, WEARER, 'Yoma')).toBe('ok')
    }
    const extra = (await service.registerDevice()).deviceId
    expect(await service.redeemPairCode((await service.issuePairCode(extra)).code, WEARER, 'Yoma')).toBe('limit')
  })

  it('refuses captures before pairing', async () => {
    await expect(service.captureUtterances(deviceId, utterances)).rejects.toMatchObject({ code: 'NOT_PAIRED' })
  })
})

describe('capture → draft', () => {
  beforeEach(pairWearer)

  it('keeps only quote-backed commitments, attributes the loudest speaker to the wearer, resolves dates', async () => {
    await connectBusiness()
    const { agreement, contacts } = await service.captureUtterances(deviceId, utterances)
    expect(agreement.status).toBe('draft')
    expect(agreement.commitments.map(c => [c.by, c.what, c.dueISO])).toEqual([
      ['counterparty', 'send the deck', '2026-11-27'],
      ['wearer', 'intro to Sara', undefined],
    ])
    expect(agreement.commitments[0]!.line).toBe('Omar Haddad ▸ send the deck · Fri 27 Nov')
    expect(agreement.contact).toEqual({ id: String(OMAR), name: 'Omar Haddad' })
    expect(contacts).toHaveLength(1)
  })

  it('swap flips who owes what', async () => {
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    const swapped = await service.swap(deviceId, agreement.id)
    expect(swapped.commitments.map(c => c.by)).toEqual(['wearer', 'counterparty'])
  })

  it('refuses NO_SPEECH on empty transcripts', async () => {
    await expect(service.captureUtterances(deviceId, [])).rejects.toMatchObject({ code: 'NO_SPEECH' })
  })

  it('ignores contacts outside Telegram\'s 24 h reply window', async () => {
    await db.upsertContact(WEARER, { tg_id: SARA, chat_id: SARA_CHAT, name: 'Sara', last_incoming_at: '2026-11-22T09:00:00.000Z' })
    const { contacts } = await service.captureUtterances(deviceId, utterances)
    expect(contacts).toHaveLength(0)
  })

  it('another device cannot touch this agreement (no cross-device access)', async () => {
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    const other = (await service.registerDevice()).deviceId
    await expect(service.discard(other, agreement.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('send → confirm / amend → checklist', () => {
  beforeEach(pairWearer)

  it('refuses to send without a business connection (honest refusal, nothing sent)', async () => {
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    await expect(service.send(deviceId, agreement.id)).rejects.toMatchObject({ code: 'NO_BUSINESS_CONNECTION' })
    expect(messenger.cards).toHaveLength(0)
  })

  it('sends to exactly the contact shown on the lens, even if contact order changed since', async () => {
    await connectBusiness()
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    await db.upsertContact(WEARER, { tg_id: SARA, chat_id: SARA_CHAT, name: 'Sara', last_incoming_at: '2026-11-24T09:59:59.000Z' }) // Sara now most recent
    await service.send(deviceId, agreement.id, String(OMAR))
    expect(messenger.cards).toEqual([{ chatId: OMAR_CHAT, businessConnectionId: 'bc_1', reviewUrl: `https://t.me/DextraBot?start=a_${agreement.id}` }])
  })

  it('refuses when the lens and server disagree on the recipient', async () => {
    await connectBusiness()
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    await expect(service.send(deviceId, agreement.id, String(SARA))).rejects.toMatchObject({ code: 'RECIPIENT_CHANGED' })
  })

  it('a double tap sends only once', async () => {
    await connectBusiness()
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    const results = await Promise.allSettled([service.send(deviceId, agreement.id), service.send(deviceId, agreement.id)])
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(messenger.cards).toHaveLength(1)
  })

  it('rolls back to draft when Telegram refuses delivery', async () => {
    await connectBusiness()
    messenger.failCard = true
    const { agreement } = await service.captureUtterances(deviceId, utterances)
    await expect(service.send(deviceId, agreement.id)).rejects.toMatchObject({ code: 'CANNOT_REPLY' })
    expect((await db.agreement(agreement.id))!.agreement.status).toBe('draft')
  })

  it('only the counterparty can confirm; confirming hashes, drops the transcript and shares a checklist', async () => {
    const id = await sentAgreement()
    await expect(service.forCounterparty(id, 999)).rejects.toThrow(ServiceError)
    const confirmed = await service.confirm(id, OMAR)
    expect(confirmed.status).toBe('confirmed')
    expect((await db.agreement(id))!.agreement.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await db.draft(id)).toBeUndefined()
    expect(messenger.checklists[0]).toEqual({
      businessConnectionId: 'bc_1',
      chatId: OMAR_CHAT,
      title: 'Agreed · Yoma & Omar Haddad',
      tasks: ['Omar Haddad: send the deck · Friday', 'Yoma: intro to Sara'],
    })
  })

  it('a confirmation survives a Telegram checklist failure and still shares the record as a message', async () => {
    const id = await sentAgreement()
    messenger.failChecklist = true
    await service.confirm(id, OMAR)
    const saved = (await db.agreement(id))!.agreement
    expect(saved.status).toBe('confirmed')
    expect(messenger.texts).toHaveLength(1)
    expect(messenger.texts[0]).toMatchObject({ businessConnectionId: 'bc_1', chatId: OMAR_CHAT })
    expect(messenger.texts[0]!.text).toContain('Omar Haddad: send the deck · Friday')
    expect(messenger.texts[0]!.text).toContain(`Record ${saved.hash!.slice(0, 12)}`)
  })

  it('a second confirm is a typed refusal, not a crash, and posts no second checklist', async () => {
    const id = await sentAgreement()
    await service.confirm(id, OMAR)
    await expect(service.confirm(id, OMAR)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    expect(messenger.checklists).toHaveLength(1)
  })

  it('amend → accept applies the counterparty change; ticks fulfil (and un-ticks reopen) the agreement', async () => {
    const id = await sentAgreement()
    const amended = await service.amend(id, OMAR, 'Monday, not Friday')
    expect(amended.status).toBe('amended')
    expect(amended.proposedCommitments?.[0]?.dueISO).toBe('2026-11-30')
    const accepted = await service.accept(deviceId, id)
    expect(accepted.status).toBe('confirmed')
    expect(accepted.commitments[0]?.dueISO).toBe('2026-11-30')

    await service.tick('bc_1', OMAR_CHAT, 555, [1], [])
    expect((await db.agreement(id))!.agreement.status).toBe('confirmed')
    await service.tick('bc_1', OMAR_CHAT, 555, [2], [])
    expect((await db.agreement(id))!.agreement.status).toBe('fulfilled')
    await service.tick('bc_1', OMAR_CHAT, 555, [], [2])
    expect((await db.agreement(id))!.agreement.status).toBe('confirmed')
  })

  it('ticks from another wearer\'s connection are ignored (checklists are tenant-scoped)', async () => {
    const id = await sentAgreement()
    await service.confirm(id, OMAR)
    await service.tick('bc_other', OMAR_CHAT, 555, [1, 2], [])
    expect((await db.agreement(id))!.agreement.status).toBe('confirmed')
  })

  it('housekeeping expires unanswered agreements after 7 days and scrubs their content', async () => {
    const id = await sentAgreement()
    const later = new AgreementService({ db, hub, transcriber, extractor, messenger, botUsername: 'DextraBot', now: () => new Date('2026-12-02T10:00:00.000Z') })
    expect((await later.housekeeping()).expired).toBe(1)
    const a = (await db.agreement(id))!.agreement
    expect(a.status).toBe('expired')
    expect(a.commitments).toEqual([])
  })
})

describe('applyAmendment gates', () => {
  const base = [
    { id: 'c1', by: 'counterparty' as const, what: 'send the deck', dueText: 'Friday', dueISO: '2026-11-27', quote: 'q', done: false },
    { id: 'c2', by: 'wearer' as const, what: 'intro to Sara', quote: 'q', done: false },
  ]
  const now = '2026-11-24T10:00:00.000Z'

  it('edits and removes existing commitments', () => {
    const out = applyAmendment(base, { changes: [{ index: 1, remove: true }, { index: 0, what: 'send the final deck' }] }, 'the final deck please, and no intro', now)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ what: 'send the final deck', dueISO: '2026-11-27' })
    expect(out[0]!.quote.startsWith('(amended)')).toBe(true)
  })

  it('refuses out-of-range indexes, dates and amounts not in the note, empty and no-op amendments', () => {
    expect(() => applyAmendment(base, { changes: [{ index: 7, what: 'x' }] }, 'x', now)).toThrow(/not agreed/)
    expect(() => applyAmendment(base, { changes: [{ index: 0, due_text: 'Sunday' }] }, 'Monday please', now)).toThrow(/date/)
    expect(() => applyAmendment(base, { changes: [{ index: 0, amount: '$9,000' }] }, 'more money', now)).toThrow(/amount/)
    expect(() => applyAmendment(base, { changes: [{ index: 0, remove: true }, { index: 1, remove: true }] }, 'cancel all', now)).toThrow(/remove everything/)
    expect(() => applyAmendment(base, { changes: [] }, 'looks good', now)).toThrow(/couldn't find a change/)
  })
})

describe('matchContact', () => {
  it('prefers exact first name, then prefix, else most recent', () => {
    const contacts = [
      { tg_id: 1, chat_id: 1, name: 'Sara Lee', last_incoming_at: '' },
      { tg_id: 2, chat_id: 2, name: 'Omar Haddad', last_incoming_at: '' },
    ]
    expect(matchContact(contacts, 'Omar')).toBe(1)
    expect(matchContact(contacts, 'om')).toBe(1)
    expect(matchContact(contacts, 'Zed')).toBe(0)
    expect(matchContact(contacts)).toBe(0)
  })
})

describe('http maps state-machine refusals to typed 409s (not 500s)', () => {
  it('double discard returns INVALID_TRANSITION', async () => {
    await pairWearer()
    const reg = await service.registerDevice()
    const { code } = await service.issuePairCode(reg.deviceId)
    await service.redeemPairCode(code, WEARER, 'Yoma')
    const { agreement } = await service.captureUtterances(reg.deviceId, utterances)
    const app = createApp(service, hub)
    const call = () => app.request(`/api/agreements/${agreement.id}/discard`, { method: 'POST', headers: { Authorization: `Bearer ${reg.deviceToken}` } })
    expect((await call()).status).toBe(200)
    const second = await call()
    expect(second.status).toBe(409)
    expect(((await second.json()) as { refusal: string }).refusal).toBe('INVALID_TRANSITION')
  })
})
