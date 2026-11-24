import { describe, expect, it } from 'vitest'
import { createDraft, transition, InvalidTransitionError } from '../src/state'
import type { Commitment } from '../src/types'

const commitments: Commitment[] = [
  { id: 'c1', by: 'counterparty', what: 'send the deck', dueISO: '2026-11-27', quote: 'deck by thursday', done: false },
  { id: 'c2', by: 'wearer', what: 'intro to Sara', quote: 'intro you to sara', done: false },
]

const base = () => createDraft({ id: 'a1', createdAt: '2026-11-24T10:00:00.000Z', wearerTgId: 1, counterpartyName: 'Omar', commitments })

describe('agreement state machine', () => {
  it('creates a draft with history entry', () => {
    const a = base()
    expect(a.status).toBe('draft')
    expect(a.history).toHaveLength(1)
    expect(a.history[0]?.event).toBe('created')
  })

  it('follows draft → sent → confirmed', () => {
    const sent = transition(base(), { type: 'send', at: '2026-11-24T10:01:00.000Z', counterpartyTgId: 42 })
    expect(sent.status).toBe('sent')
    expect(sent.counterpartyTgId).toBe(42)
    const confirmed = transition(sent, { type: 'confirm', at: '2026-11-24T10:02:00.000Z', by: 42 })
    expect(confirmed.status).toBe('confirmed')
    expect(confirmed.history.map(h => h.event)).toEqual(['created', 'send', 'confirm'])
  })

  it('never mutates the input agreement', () => {
    const a = base()
    const snapshot = JSON.stringify(a)
    transition(a, { type: 'send', at: '2026-11-24T10:01:00.000Z', counterpartyTgId: 42 })
    expect(JSON.stringify(a)).toBe(snapshot)
  })

  it('handles amend → accept and amend → reject', () => {
    const sent = transition(base(), { type: 'send', at: 't1', counterpartyTgId: 42 })
    const amendedCommitments = [{ ...commitments[0]!, dueISO: '2026-11-28', what: 'send the deck' }, commitments[1]!]
    const amended = transition(sent, { type: 'amend', at: 't2', by: 42, commitments: amendedCommitments, note: 'Friday, not Thursday' })
    expect(amended.status).toBe('amended')
    expect(amended.proposedCommitments?.[0]?.dueISO).toBe('2026-11-28')
    expect(amended.commitments[0]?.dueISO).toBe('2026-11-27')

    const accepted = transition(amended, { type: 'accept', at: 't3' })
    expect(accepted.status).toBe('confirmed')
    expect(accepted.commitments[0]?.dueISO).toBe('2026-11-28')
    expect(accepted.proposedCommitments).toBeUndefined()

    const rejected = transition(amended, { type: 'reject', at: 't3' })
    expect(rejected.status).toBe('sent')
    expect(rejected.commitments[0]?.dueISO).toBe('2026-11-27')
  })

  it('marks fulfilled when every commitment is done', () => {
    let a = transition(transition(base(), { type: 'send', at: 't1', counterpartyTgId: 42 }), { type: 'confirm', at: 't2', by: 42 })
    a = transition(a, { type: 'tick', at: 't3', commitmentId: 'c1', done: true })
    expect(a.status).toBe('confirmed')
    a = transition(a, { type: 'tick', at: 't4', commitmentId: 'c2', done: true })
    expect(a.status).toBe('fulfilled')
  })

  it('rejects confirmation by someone other than the counterparty', () => {
    const sent = transition(base(), { type: 'send', at: 't1', counterpartyTgId: 42 })
    expect(() => transition(sent, { type: 'confirm', at: 't2', by: 7 })).toThrow(InvalidTransitionError)
  })

  it('rejects illegal transitions with a typed error', () => {
    expect(() => transition(base(), { type: 'confirm', at: 't', by: 42 })).toThrow(InvalidTransitionError)
    const discarded = transition(base(), { type: 'discard', at: 't' })
    expect(() => transition(discarded, { type: 'send', at: 't', counterpartyTgId: 42 })).toThrow(InvalidTransitionError)
    try {
      transition(discarded, { type: 'send', at: 't', counterpartyTgId: 42 })
    } catch (e) {
      expect((e as InvalidTransitionError).code).toBe('INVALID_TRANSITION')
    }
  })

  it('expires sent agreements', () => {
    const sent = transition(base(), { type: 'send', at: 't1', counterpartyTgId: 42 })
    expect(transition(sent, { type: 'expire', at: 't9' }).status).toBe('expired')
  })
})
