import { describe, expect, it } from 'vitest'
import { normalizeForMatch, validateProposal } from '../src/validate'
import type { Utterance } from '../src/types'

const utterances: Utterance[] = [
  { speaker: 0, start: 0, end: 3.1, text: 'So you will send me the deck by Thursday, right?' },
  { speaker: 1, start: 3.2, end: 6.0, text: "Yes. Deck by Thursday. And you'll intro me to Sara?" },
  { speaker: 0, start: 6.1, end: 8.0, text: "Deal, I'll intro you to Sara this week." },
]

describe('normalizeForMatch', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalizeForMatch("  Deal,  I'll   intro YOU!! ")).toBe('deal ill intro you')
  })
})

describe('validateProposal', () => {
  it('keeps commitments whose quote appears in the transcript and maps speakers to parties', () => {
    const result = validateProposal(
      {
        counterpartyName: 'Omar',
        commitments: [
          { speaker: 1, what: 'Send the deck', due_text: 'Thursday', quote: 'Deck by Thursday' },
          { speaker: 0, what: 'Intro to Sara', due_text: 'this week', quote: "I'll intro you to Sara" },
        ],
      },
      utterances,
      0,
    )
    expect(result.refusal).toBeUndefined()
    expect(result.commitments).toHaveLength(2)
    expect(result.commitments[0]).toMatchObject({ by: 'counterparty', what: 'Send the deck', quote: 'Deck by Thursday' })
    expect(result.commitments[1]).toMatchObject({ by: 'wearer', what: 'Intro to Sara' })
    expect(result.dropped).toHaveLength(0)
  })

  it('drops commitments the transcript does not support (UNSUPPORTED_BY_TRANSCRIPT)', () => {
    const result = validateProposal(
      {
        counterpartyName: 'Omar',
        commitments: [
          { speaker: 1, what: 'Send the deck', quote: 'deck by thursday' },
          { speaker: 1, what: 'Pay $5,000 upfront', quote: 'I will pay five thousand upfront' },
        ],
      },
      utterances,
      0,
    )
    expect(result.commitments).toHaveLength(1)
    expect(result.dropped).toEqual([{ what: 'Pay $5,000 upfront', code: 'UNSUPPORTED_BY_TRANSCRIPT' }])
  })

  it('refuses with NO_COMMITMENT when nothing survives', () => {
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'Invented', quote: 'never said' }] }, utterances, 0)
    expect(result.commitments).toHaveLength(0)
    expect(result.refusal).toBe('NO_COMMITMENT')
  })

  it('rejects malformed proposals instead of trusting them', () => {
    const result = validateProposal({ commitments: [{ what: 42 }] } as unknown, utterances, 0)
    expect(result.refusal).toBe('MALFORMED_PROPOSAL')
  })

  it('rejects trivial quotes that would match almost anything ("the", "yes")', () => {
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'send the deck', quote: 'Yes' }] }, utterances, 0)
    expect(result.dropped[0]?.code).toBe('UNSUPPORTED_BY_TRANSCRIPT')
  })

  it('matches on word boundaries, not inside other words', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: 'I will resend the deckhand report' }]
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'send the deck', quote: 'send the deck' }] }, u, 0)
    expect(result.commitments).toHaveLength(0)
  })

  it('drops commitments whose amount was never said', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: 'I will pay you for the design work' }]
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'pay for design', amount: '$50,000', quote: 'I will pay you for the design work' }] }, u, 0)
    expect(result.dropped[0]?.code).toBe('UNSUPPORTED_BY_TRANSCRIPT')
  })

  it('keeps amounts that were said (digits match even when formatted differently)', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: 'I will pay you 2000 dollars for the design' }]
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'pay for design', amount: '$2,000', quote: 'I will pay you 2000 dollars' }] }, u, 0)
    expect(result.commitments).toHaveLength(1)
  })

  it('accepts amounts spoken as words ("two thousand" backs "$2,000")', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: "So it's three screens for two thousand dollars" }]
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'build three screens', amount: '$2,000', quote: 'three screens for two thousand dollars' }] }, u, 0)
    expect(result.commitments).toHaveLength(1)
  })

  it('accepts short but meaningful quotes ("Friday works") and still rejects filler ("ok sure")', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: 'Wednesday is tight. Friday works. Ok sure.' }]
    const ok = validateProposal({ commitments: [{ speaker: 1, what: 'deliver', due_text: 'Friday', quote: 'Friday works' }] }, u, 0)
    expect(ok.commitments).toHaveLength(1)
    const filler = validateProposal({ commitments: [{ speaker: 1, what: 'deliver', quote: 'Ok sure' }] }, u, 0)
    expect(filler.commitments).toHaveLength(0)
  })

  it('rejects links and handles in commitment text (injection shape)', () => {
    const u: Utterance[] = [{ speaker: 1, start: 0, end: 1, text: 'I will send the deck by Friday for sure' }]
    const result = validateProposal({ commitments: [{ speaker: 1, what: 'send to @scammer via evil.com', quote: 'I will send the deck by Friday' }] }, u, 0)
    expect(result.dropped[0]?.code).toBe('UNSUPPORTED_BY_TRANSCRIPT')
  })

  it('requires the quote to come from the attributed speaker', () => {
    const result = validateProposal(
      { commitments: [{ speaker: 0, what: 'Send the deck', quote: 'the deck by Thursday' }] },
      [
        { speaker: 0, start: 0, end: 1, text: 'Can you do it?' },
        { speaker: 1, start: 1, end: 2, text: 'Yes, the deck by Thursday.' },
      ],
      0,
    )
    expect(result.commitments).toHaveLength(0)
    expect(result.dropped[0]?.code).toBe('UNSUPPORTED_BY_TRANSCRIPT')
  })
})

import { isRepeat } from '../src/validate'

describe('repeated commitments are merged, distinct ones are kept', () => {
  const c = (speaker: number, what: string, dueText?: string, amount?: string) => ({ speaker, what, dueText, amount })

  it('merges a repeat, including a mis-heard one with the same deadline', () => {
    expect(isRepeat(c(0, 'introduce you to Sarah'), c(0, 'Introduce you to Sarah.'))).toBe(true)
    expect(isRepeat(c(0, 'send deck', 'Friday'), c(0, 'sell deck', 'Friday'))).toBe(true)
    expect(isRepeat(c(1, 'pay rent', undefined, '$500'), c(1, 'pay the rent money', undefined, '500 dollars'))).toBe(true)
  })

  it('keeps different things, different people, and same thing on different days', () => {
    expect(isRepeat(c(0, 'send the deck', 'Friday'), c(0, 'send the invoice', 'Friday'))).toBe(false)
    expect(isRepeat(c(0, 'send deck', 'Friday'), c(1, 'send deck', 'Friday'))).toBe(false)
    expect(isRepeat(c(0, 'send deck', 'Friday'), c(0, 'send updated deck', 'Monday'))).toBe(false)
  })
})
