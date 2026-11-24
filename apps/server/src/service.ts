import {
  agreementHash,
  createDraft,
  normalizeForMatch,
  pickWearer,
  relabelByTurns,
  resolveDue,
  speakerCount,
  transition,
  validateProposal,
  type Agreement,
  type AgreementView,
  type Commitment,
  type Contact,
  type DeviceState,
  type Proposal,
  type Utterance,
} from '@dextra/core'
import type { ContactRow, Db, DraftRow } from './db'
import { ServiceError } from './errors'
import type { Amendment, Extractor } from './extract'
import type { Hub } from './hub'
import { hashToken, newId, newPairCode, newToken, safeName } from './ids'
import type { Transcriber } from './stt'
import { toView } from './view'
import { attributeSpeakers, parseWav, withLoudness } from './wav'

const PAIR_TTL_MS = 10 * 60_000
const DRAFT_TTL_MS = 24 * 60 * 60_000
const REPLY_WINDOW_MS = 24 * 60 * 60_000
const AWAIT_TTL_MS = 7 * 24 * 60 * 60_000
const DUE_SOON_MS = 2 * 24 * 60 * 60_000
const MAX_DEVICES_PER_WEARER = 3
const MAX_AUDIO_SECONDS = 50
const SAMPLE_RATE_RANGE = [8000, 48000] as const

/** Telegram side effects the service needs. Implemented by bot.ts; kept narrow so the service stays testable. */
export interface Messenger {
  sendAgreementCard(p: { businessConnectionId: string; chatId: number; wearerName: string; agreement: Agreement; reviewUrl: string }): Promise<void>
  postChecklist(p: { businessConnectionId: string; chatId: number; title: string; tasks: string[] }): Promise<{ messageId: number }>
  notify(chatId: number, text: string): Promise<void>
}

export interface Deps {
  db: Db
  hub: Hub
  transcriber: Transcriber
  extractor: Extractor
  messenger: Messenger
  botUsername: string
  now?: () => Date
  log?: (msg: string) => void
}

export class AgreementService {
  /** Per-agreement serialisation: every mutation re-reads fresh state inside its slot (no lost updates). */
  private readonly slots = new Map<string, Promise<unknown>>()

  constructor(private readonly d: Deps) {}

  private nowISO(offsetMs = 0): string {
    return new Date((this.d.now?.() ?? new Date()).getTime() + offsetMs).toISOString()
  }

  private serial<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
    const prev = this.slots.get(id) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(fn)
    this.slots.set(id, next)
    void next.finally(() => { if (this.slots.get(id) === next) this.slots.delete(id) }).catch(() => undefined)
    return next
  }

  private contactsFor(wearerTgId: number): Promise<ContactRow[]> {
    return this.d.db.contacts(wearerTgId, this.nowISO(-REPLY_WINDOW_MS))
  }

  // ── devices & pairing ────────────────────────────────────────────────
  async registerDevice(): Promise<{ deviceId: string; deviceToken: string }> {
    const deviceId = newId('dev')
    const deviceToken = newToken()
    await this.d.db.insertDevice(deviceId, hashToken(deviceToken), this.nowISO())
    return { deviceId, deviceToken }
  }

  async authenticate(token: string | undefined): Promise<string> {
    const row = token ? await this.d.db.deviceByTokenHash(hashToken(token)) : undefined
    if (!row) throw new ServiceError('UNAUTHORIZED', 'This device is not registered.', 401)
    return row.id
  }

  async issuePairCode(deviceId: string): Promise<{ code: string; expiresAt: string; botUsername: string }> {
    if ((await this.d.db.device(deviceId))?.wearer_tg_id) throw new ServiceError('ALREADY_PAIRED', 'These glasses are already linked.', 409)
    const code = newPairCode()
    const expiresAt = this.nowISO(PAIR_TTL_MS)
    await this.d.db.savePairCode(code, deviceId, expiresAt)
    return { code, expiresAt, botUsername: this.d.botUsername }
  }

  /** Called by the bot when the wearer sends /pair CODE. Never re-binds an already linked device. */
  async redeemPairCode(code: string, tgId: number, name: string): Promise<'ok' | 'invalid' | 'limit'> {
    const deviceId = await this.d.db.takePairCode(code.trim().toUpperCase(), this.nowISO())
    if (!deviceId || (await this.d.db.device(deviceId))?.wearer_tg_id) return 'invalid'
    if ((await this.d.db.countDevicesForWearer(tgId)) >= MAX_DEVICES_PER_WEARER) return 'limit'
    const clean = safeName(name)
    await this.d.db.upsertWearer(tgId, clean, this.nowISO())
    await this.d.db.bindDevice(deviceId, tgId)
    this.d.hub.publish(deviceId, { type: 'paired', wearerName: clean })
    return 'ok'
  }

  async deviceState(deviceId: string): Promise<DeviceState> {
    const dev = await this.d.db.device(deviceId)
    const wearer = dev?.wearer_tg_id ? await this.d.db.wearer(dev.wearer_tg_id) : undefined
    const list = await this.d.db.agreementsForDevice(deviceId, 50)
    const soon = Date.parse(this.nowISO(DUE_SOON_MS))
    const open = list.filter(a => a.status === 'sent' || a.status === 'amended' || a.status === 'confirmed')
    const dueSoon = open.flatMap(a => a.commitments).filter(c => !c.done && c.dueISO && Date.parse(c.dueISO) <= soon).length
    return { paired: Boolean(wearer), wearerName: wearer?.name, businessConnected: Boolean(wearer?.connected), open: open.length, dueSoon }
  }

  // ── capture → draft ─────────────────────────────────────────────────
  /** Throws NOT_PAIRED. Called before reading any request body. */
  async wearerOf(deviceId: string): Promise<number> {
    const tg = (await this.d.db.device(deviceId))?.wearer_tg_id
    if (!tg) throw new ServiceError('NOT_PAIRED', 'Link your Telegram first: send /pair with the code on your lens.', 409)
    return tg
  }

  async captureAudio(deviceId: string, wav: Uint8Array): Promise<{ agreement: AgreementView; contacts: Contact[] }> {
    await this.wearerOf(deviceId)
    let pcm
    try {
      pcm = parseWav(wav)
    } catch {
      throw new ServiceError('BAD_AUDIO', 'The audio could not be read. Hold to lock again.')
    }
    const seconds = pcm.samples.length / pcm.sampleRate
    if (pcm.sampleRate < SAMPLE_RATE_RANGE[0] || pcm.sampleRate > SAMPLE_RATE_RANGE[1] || seconds > MAX_AUDIO_SECONDS) {
      throw new ServiceError('BAD_AUDIO', 'Unexpected audio format.', 413)
    }
    const heard = withLoudness(await this.d.transcriber.transcribe(wav), pcm)
    const { utterances } = attributeSpeakers(heard, pcm) // voice separation → voice pitch → (LLM turns, below)
    return this.captureUtterances(deviceId, utterances)
  }

  async captureUtterances(deviceId: string, heard: Utterance[]): Promise<{ agreement: AgreementView; contacts: Contact[] }> {
    const wearerTgId = await this.wearerOf(deviceId)
    if (heard.length === 0) throw new ServiceError('NO_SPEECH', 'No speech was heard in the last 45 seconds.')
    const proposal = await this.d.extractor.propose(heard)
    // Voice separation fails on short clips; then the proposed per-line turns are used (marked as inferred).
    const { utterances, inferred } = relabelByTurns(heard, proposal.turns)
    const pick = pickWearer(utterances, [])
    const capturedAt = this.nowISO()
    const id = newId('agr')
    const contacts = await this.contactsFor(wearerTgId)
    const built = this.build(proposal, utterances, pick.wearer, capturedAt)
    const contact = contacts[matchContact(contacts, proposal.counterpartyName)]
    const agreement = createDraft({ id, createdAt: capturedAt, wearerTgId, counterpartyName: contact?.name ?? safeName(proposal.counterpartyName ?? 'them'), commitments: built })
    await this.d.db.saveAgreement(agreement, deviceId, capturedAt)
    await this.d.db.insertDraft(id, { utterances, proposal, wearerSpeaker: pick.wearer, contactTgId: contact?.tg_id ?? null, capturedAt }, this.nowISO(DRAFT_TTL_MS))
    return {
      agreement: toView(agreement, { warnings: this.warnings(utterances, inferred ? 'low' : pick.confidence, inferred), contact: contactView(contact) }),
      contacts: contacts.map(contactView).filter(isDefined),
    }
  }

  private build(proposal: Proposal, utterances: Utterance[], wearerSpeaker: number, capturedAt: string): Commitment[] {
    const result = validateProposal(proposal, utterances, wearerSpeaker)
    if (result.refusal) throw new ServiceError(result.refusal, refusalMessage(result.refusal))
    return result.commitments.map((c, i) => ({
      id: `c${i + 1}`,
      by: c.by,
      what: c.what,
      dueText: c.dueText,
      dueISO: resolveDue(c.dueText, capturedAt),
      amount: c.amount,
      quote: c.quote,
      done: false,
    }))
  }

  private warnings(utterances: Utterance[], confidence: 'high' | 'low', inferred = false): string[] {
    if (speakerCount(utterances) < 2) return ['One voice heard — check who owes what']
    if (inferred) return ['Who said what was inferred · swipe if swapped']
    return confidence === 'low' ? ['Swipe if You/Them are swapped'] : []
  }

  // ── wearer actions on the lens ──────────────────────────────────────
  private async owned(deviceId: string, id: string): Promise<Agreement> {
    const row = await this.d.db.agreement(id)
    if (!row || row.deviceId !== deviceId) throw new ServiceError('NOT_FOUND', 'That agreement is gone.', 404)
    return row.agreement
  }

  private async draftOf(id: string, a: Agreement): Promise<DraftRow> {
    const draft = await this.d.db.draft(id)
    if (a.status !== 'draft') throw new ServiceError('INVALID_TRANSITION', 'This agreement was already sent.', 409)
    if (!draft) throw new ServiceError('DRAFT_EXPIRED', 'This draft expired. Hold to lock again.', 410)
    return draft
  }

  private async persist(deviceId: string, a: Agreement, extra: { warnings?: string[]; contact?: Contact } = {}): Promise<AgreementView> {
    await this.d.db.saveAgreement(a, deviceId, this.nowISO())
    const view = toView(a, extra)
    this.d.hub.publish(deviceId, { type: 'agreement', agreement: view })
    return view
  }

  swap(deviceId: string, id: string): Promise<AgreementView> {
    return this.serial(id, async () => {
      const a = await this.owned(deviceId, id)
      const draft = await this.draftOf(id, a)
      const speakers = [...new Set(draft.utterances.map(u => u.speaker))]
      const next = speakers.find(s => s !== draft.wearerSpeaker) ?? draft.wearerSpeaker
      const commitments = this.build(draft.proposal, draft.utterances, next, draft.capturedAt)
      if (!await this.d.db.updateDraftChoice(id, next, draft.contactTgId)) throw new ServiceError('DRAFT_EXPIRED', 'This draft expired. Hold to lock again.', 410)
      const contact = draft.contactTgId ? await this.d.db.contact(a.wearerTgId, draft.contactTgId) : undefined
      return await this.persist(deviceId, { ...a, commitments }, { contact: contactView(contact) })
    })
  }

  nextContact(deviceId: string, id: string): Promise<AgreementView> {
    return this.serial(id, async () => {
      const a = await this.owned(deviceId, id)
      const draft = await this.draftOf(id, a)
      const contacts = await this.contactsFor(a.wearerTgId)
      if (contacts.length === 0) throw new ServiceError('NO_CONTACTS', 'No one has messaged you on Telegram in the last 24 h, so there is no one to send to yet.', 409)
      const current = contacts.findIndex(c => c.tg_id === draft.contactTgId)
      const contact = contacts[(current + 1) % contacts.length]!
      if (!await this.d.db.updateDraftChoice(id, draft.wearerSpeaker, contact.tg_id)) throw new ServiceError('DRAFT_EXPIRED', 'This draft expired. Hold to lock again.', 410)
      return await this.persist(deviceId, { ...a, counterpartyName: contact.name }, { contact: contactView(contact) })
    })
  }

  /**
   * Sends to exactly the contact the lens showed (by Telegram id). The `sent` status is saved before the Telegram call
   * so a second tap is refused, and rolled back if Telegram refuses.
   */
  send(deviceId: string, id: string, expectedContactId?: string): Promise<AgreementView> {
    return this.serial(id, async () => {
      const a = await this.owned(deviceId, id)
      const draft = await this.draftOf(id, a)
      const wearer = await this.d.db.wearer(a.wearerTgId)
      if (!wearer?.business_connection_id || !wearer.connected) throw new ServiceError('NO_BUSINESS_CONNECTION', 'Add Dextra in Telegram ▸ Settings ▸ Chat Automation, then tap again.', 409)
      if (!wearer.can_reply) throw new ServiceError('CANNOT_REPLY', 'Give Dextra permission to reply in Chat Automation settings, then tap again.', 409)
      const contact = draft.contactTgId ? (await this.contactsFor(a.wearerTgId)).find(c => c.tg_id === draft.contactTgId) : undefined
      if (!contact) throw new ServiceError('CANNOT_REPLY', 'Telegram only lets Dextra message people who wrote to you in the last 24 h. Swipe to pick someone else.', 409)
      if (expectedContactId && expectedContactId !== String(contact.tg_id)) throw new ServiceError('RECIPIENT_CHANGED', 'The recipient changed. Check the card and tap again.', 409)
      const sent = transition({ ...a, counterpartyName: contact.name }, { type: 'send', at: this.nowISO(), counterpartyTgId: contact.tg_id })
      await this.d.db.saveAgreement(sent, deviceId, this.nowISO())
      try {
        await this.d.messenger.sendAgreementCard({ businessConnectionId: wearer.business_connection_id, chatId: contact.chat_id, wearerName: wearer.name, agreement: sent, reviewUrl: `https://t.me/${this.d.botUsername}?start=a_${id}` })
      } catch {
        await this.d.db.saveAgreement(a, deviceId, this.nowISO())
        throw new ServiceError('CANNOT_REPLY', 'Telegram did not deliver it (the 24 h reply window may have closed). Nothing was sent.', 409)
      }
      return await this.persist(deviceId, sent, { contact: contactView(contact) })
    })
  }

  discard(deviceId: string, id: string): Promise<AgreementView> {
    return this.serial(id, async () => {
      const a = transition(await this.owned(deviceId, id), { type: 'discard', at: this.nowISO() })
      await this.d.db.deleteDraft(id)
      return await this.persist(deviceId, scrub(a))
    })
  }

  accept(deviceId: string, id: string): Promise<AgreementView> {
    return this.serial(id, async () => this.finalize(deviceId, transition(await this.owned(deviceId, id), { type: 'accept', at: this.nowISO() })))
  }

  reject(deviceId: string, id: string): Promise<AgreementView> {
    return this.serial(id, async () => {
      const a = transition(await this.owned(deviceId, id), { type: 'reject', at: this.nowISO() })
      if (a.counterpartyTgId) await this.d.messenger.notify(a.counterpartyTgId, 'Your change was not accepted. The original version still stands — tap Change again to propose something else.').catch(() => undefined)
      return await this.persist(deviceId, a)
    })
  }

  async list(deviceId: string): Promise<AgreementView[]> {
    return (await this.d.db.agreementsForDevice(deviceId)).map(a => toView(a))
  }

  // ── counterparty actions (from the bot) ─────────────────────────────
  async forCounterparty(id: string, tgId: number): Promise<Agreement> {
    const row = await this.d.db.agreement(id)
    if (!row || row.agreement.counterpartyTgId !== tgId) throw new ServiceError('NOT_FOUND', 'This agreement was not found.', 404)
    return row.agreement
  }

  confirm(id: string, tgId: number): Promise<Agreement> {
    return this.serial(id, async () => {
      const row = await this.d.db.agreement(id)
      if (!row || row.agreement.counterpartyTgId !== tgId) throw new ServiceError('NOT_FOUND', 'This agreement was not found.', 404)
      const confirmed = transition(row.agreement, { type: 'confirm', at: this.nowISO(), by: tgId })
      await this.finalize(row.deviceId, confirmed)
      return confirmed
    })
  }

  amend(id: string, tgId: number, note: string): Promise<Agreement> {
    return this.serial(id, async () => {
      const before = await this.forCounterparty(id, tgId)
      if (before.status !== 'sent') throw new ServiceError('INVALID_TRANSITION', 'This agreement can no longer be changed.', 409)
      const changes = await this.d.extractor.amend(before.commitments, note)
      const fresh = await this.forCounterparty(id, tgId) // re-read after the LLM call: a confirm may have landed meanwhile
      const proposed = applyAmendment(fresh.commitments, changes, note, this.nowISO())
      const amended = transition(fresh, { type: 'amend', at: this.nowISO(), by: tgId, commitments: proposed, note: note.slice(0, 200) })
      await this.persist((await this.d.db.agreement(id))!.deviceId, amended)
      return amended
    })
  }

  /** Confirmed: state + hash are saved first; the shared checklist is best-effort and never blocks the confirmation. */
  private async finalize(deviceId: string, a: Agreement): Promise<AgreementView> {
    const withHash = { ...a, hash: agreementHash(a) }
    const view = await this.persist(deviceId, withHash)
    await this.d.db.deleteDraft(a.id)
    const wearer = await this.d.db.wearer(a.wearerTgId)
    const contact = a.counterpartyTgId ? await this.d.db.contact(a.wearerTgId, a.counterpartyTgId) : undefined
    if (wearer?.business_connection_id && contact && withHash.commitments.length > 0) {
      try {
        const tasks = withHash.commitments.map(c => checklistTask(c, a.counterpartyName, wearer.name))
        const { messageId } = await this.d.messenger.postChecklist({ businessConnectionId: wearer.business_connection_id, chatId: contact.chat_id, title: `Agreed · ${wearer.name} & ${a.counterpartyName}`, tasks })
        await this.d.db.saveChecklist({ agreement_id: a.id, business_connection_id: wearer.business_connection_id, chat_id: contact.chat_id, message_id: messageId })
      } catch {
        this.d.log?.('[dextra] checklist not posted (Telegram refused); agreement stays confirmed')
      }
    }
    return view
  }

  /** Checklist ticks from Telegram (task ids are 1-based commitment positions), scoped to the wearer's connection. */
  async tick(connectionId: string, chatId: number, messageId: number, doneTaskIds: number[], undoneTaskIds: number[]): Promise<void> {
    const link = await this.d.db.checklistByMessage(connectionId, chatId, messageId)
    if (!link) return
    return this.serial(link.agreement_id, async () => {
      const row = await this.d.db.agreement(link.agreement_id)
      if (!row) return
      let a = row.agreement
      for (const [ids, done] of [[doneTaskIds, true], [undoneTaskIds, false]] as const) {
        for (const taskId of ids) {
          const c = a.commitments[taskId - 1]
          if (c && c.done !== done && (a.status === 'confirmed' || a.status === 'fulfilled')) a = transition(a, { type: 'tick', at: this.nowISO(), commitmentId: c.id, done })
        }
      }
      if (a !== row.agreement) await this.persist(row.deviceId, a)
    })
  }

  // ── housekeeping ────────────────────────────────────────────────────
  /** Expire agreements nobody answered within 7 days, scrub their content, prune stale drafts and contacts. */
  async housekeeping(): Promise<{ expired: number }> {
    const stale = await this.d.db.staleAwaiting(this.nowISO(-AWAIT_TTL_MS))
    for (const { agreement, deviceId } of stale) {
      await this.serial(agreement.id, () => this.persist(deviceId, scrub(transition(agreement, { type: 'expire', at: this.nowISO() })))).catch(() => undefined)
    }
    await this.d.db.purgeExpiredDrafts(this.nowISO())
    await this.d.db.pruneContacts(this.nowISO(-REPLY_WINDOW_MS))
    return { expired: stale.length }
  }
}

/** Discarded and expired records keep no conversation content (PRD §6). */
function scrub(a: Agreement): Agreement {
  return { ...a, commitments: [], proposedCommitments: undefined }
}

/**
 * Applies a counterparty correction. Deterministic gates: indexes must exist; any new date or amount must come from the
 * counterparty's own words; at least one commitment must remain; something must actually change.
 */
export function applyAmendment(commitments: Commitment[], amendment: Amendment, note: string, nowISO: string): Commitment[] {
  const said = ` ${normalizeForMatch(note)} `
  const inNote = (text: string) => normalizeForMatch(text).split(' ').every(w => said.includes(` ${w} `))
  for (const ch of amendment.changes) {
    if (ch.index >= commitments.length) throw new ServiceError('AMEND_UNSUPPORTED', 'That change refers to something that was not agreed.', 422)
    if (ch.due_text && !inNote(ch.due_text)) throw new ServiceError('AMEND_UNSUPPORTED', 'The new date must come from your message.', 422)
    if (ch.amount && !(ch.amount.match(/\d+/g) ?? []).every(d => said.includes(d))) throw new ServiceError('AMEND_UNSUPPORTED', 'The new amount must come from your message.', 422)
  }
  const byIndex = new Map(amendment.changes.map(c => [c.index, c]))
  const out = commitments.flatMap((c, i) => {
    const ch = byIndex.get(i)
    if (!ch) return [{ ...c }]
    if (ch.remove) return []
    const dueText = ch.due_text || c.dueText
    const changedWhat = ch.what && ch.what !== c.what
    return [{ ...c, what: ch.what ?? c.what, amount: ch.amount || c.amount, dueText, dueISO: ch.due_text ? resolveDue(ch.due_text, nowISO) : c.dueISO, quote: changedWhat ? `(amended) ${note.slice(0, 120)}` : c.quote }]
  })
  if (out.length === 0) throw new ServiceError('AMEND_EMPTY', 'A change cannot remove everything. Tap Confirm or describe what to change.', 422)
  if (JSON.stringify(out) === JSON.stringify(commitments)) throw new ServiceError('AMEND_NO_CHANGE', "I couldn't find a change in that message. Try e.g. \"Monday, not Friday\".", 422)
  return out
}

/** Best contact for the spoken name: exact first-name match, else prefix, else the most recent contact. */
export function matchContact(contacts: ContactRow[], name?: string): number {
  if (!name || contacts.length === 0) return 0
  const n = name.trim().toLowerCase()
  const first = (s: string) => s.trim().toLowerCase().split(/\s+/)[0] ?? ''
  const exact = contacts.findIndex(c => first(c.name) === n)
  if (exact >= 0) return exact
  const prefix = contacts.findIndex(c => first(c.name).startsWith(n) || n.startsWith(first(c.name)))
  return prefix >= 0 ? prefix : 0
}

function checklistTask(c: Commitment, counterpartyName: string, wearerName: string): string {
  const who = c.by === 'wearer' ? wearerName : counterpartyName
  return [`${who}: ${c.what}`, c.amount, c.dueText].filter(Boolean).join(' · ').slice(0, 100)
}

function contactView(c?: ContactRow): Contact | undefined {
  return c ? { id: String(c.tg_id), name: c.name } : undefined
}

function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined
}

function refusalMessage(code: string): string {
  if (code === 'NO_COMMITMENT') return 'No clear commitment was heard. Nothing was sent.'
  if (code === 'MALFORMED_PROPOSAL') return 'Could not read commitments from that conversation. Try again.'
  return 'Not locked.'
}
