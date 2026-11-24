import { describe, expect, it } from 'vitest'
import { resolveDue } from '../src/dates'
import { canonicalJSON, agreementHash } from '../src/canonical'
import { commitmentLine, fitLine } from '../src/format'
import { createDraft } from '../src/state'

describe('resolveDue', () => {
  const ref = '2026-11-24T10:00:00.000Z' // a Tuesday
  it('resolves weekday names forward from the capture time', () => {
    expect(resolveDue('Thursday', ref)).toBe('2026-11-26')
    expect(resolveDue('by Friday', ref)).toBe('2026-11-27')
  })
  it('resolves relative phrases', () => {
    expect(resolveDue('tomorrow', ref)).toBe('2026-11-25')
    expect(resolveDue('next Monday', ref)).toBe('2026-11-30')
  })
  it('returns undefined when there is no date', () => {
    expect(resolveDue('soon-ish', ref)).toBeUndefined()
    expect(resolveDue(undefined, ref)).toBeUndefined()
  })
})

describe('canonical hash', () => {
  it('is independent of key order', () => {
    expect(canonicalJSON({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,1]},"b":1}')
  })
  it('hashes only the agreed content, stable across history noise', () => {
    const c = [{ id: 'c1', by: 'counterparty' as const, what: 'send the deck', dueISO: '2026-11-27', quote: 'deck by thursday', done: false }]
    const a = createDraft({ id: 'a1', createdAt: '2026-11-24T10:00:00.000Z', wearerTgId: 1, counterpartyName: 'Omar', commitments: c })
    const h1 = agreementHash({ ...a, counterpartyTgId: 42 })
    const h2 = agreementHash({ ...a, counterpartyTgId: 42, history: [] })
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).toBe(h2)
    expect(agreementHash({ ...a, counterpartyTgId: 42, commitments: [{ ...c[0]!, dueISO: '2026-11-28' }] })).not.toBe(h1)
  })
})

describe('lens formatting', () => {
  it('renders who → what · due', () => {
    expect(commitmentLine({ by: 'counterparty', what: 'send the deck', dueISO: '2026-11-27' }, 'Omar')).toBe('Omar ▸ send the deck · Fri 27 Nov')
    expect(commitmentLine({ by: 'wearer', what: 'intro to Sara' }, 'Omar')).toBe('You ▸ intro to Sara')
  })
  it('includes amounts', () => {
    expect(commitmentLine({ by: 'wearer', what: 'pay for design', amount: '$2,000' }, 'Ana')).toBe('You ▸ pay for design · $2,000')
  })
  it('fits lines to a character budget with an ellipsis', () => {
    expect(fitLine('a'.repeat(80), 40)).toHaveLength(40)
    expect(fitLine('a'.repeat(80), 40).endsWith('…')).toBe(true)
    expect(fitLine('short', 40)).toBe('short')
  })
})
