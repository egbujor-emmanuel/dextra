import { describe, expect, it } from 'vitest'
import { pickWearer, relabelByTurns, speakerCount } from '../src/attribution'
import type { Utterance } from '../src/types'

const u = (speaker: number, start: number, end: number, rms?: number): Utterance => ({ speaker, start, end, text: 'x', rms })

describe('speakerCount', () => {
  it('counts distinct speakers', () => {
    expect(speakerCount([u(0, 0, 1), u(1, 1, 2), u(0, 2, 3)])).toBe(2)
    expect(speakerCount([])).toBe(0)
  })
})

describe('relabelByTurns', () => {
  const single = [u(0, 0, 1), u(0, 1, 2), u(0, 2, 3)]

  it('applies well-formed turns when voice separation found one speaker', () => {
    const r = relabelByTurns(single, [0, 1, 0])
    expect(r.inferred).toBe(true)
    expect(r.utterances.map(x => x.speaker)).toEqual([0, 1, 0])
  })

  it('never overrides real voice labels', () => {
    const r = relabelByTurns([u(0, 0, 1), u(1, 1, 2)], [1, 1])
    expect(r).toEqual({ utterances: [u(0, 0, 1), u(1, 1, 2)], inferred: false })
  })

  it('ignores malformed turns (wrong length, one person only, missing)', () => {
    expect(relabelByTurns(single, [0, 1]).inferred).toBe(false)
    expect(relabelByTurns(single, [0, 0, 0]).inferred).toBe(false)
    expect(relabelByTurns(single, undefined).inferred).toBe(false)
  })
})

describe('pickWearer', () => {
  it('prefers speakerRole=self hints from G2 hardware when present', () => {
    const r = pickWearer([u(0, 0, 2, 0.5), u(1, 2, 4, 0.1)], [{ start: 2.1, end: 3.9, role: 'self' }])
    expect(r).toEqual({ wearer: 1, method: 'speakerRole', confidence: 'high' })
  })

  it('falls back to loudest mean RMS (mic is on the wearer\'s head)', () => {
    const r = pickWearer([u(0, 0, 2, 0.05), u(1, 2, 4, 0.31), u(0, 4, 5, 0.07)], [])
    expect(r.wearer).toBe(1)
    expect(r.method).toBe('loudness')
  })

  it('marks low confidence when loudness is too close to call', () => {
    const r = pickWearer([u(0, 0, 2, 0.2), u(1, 2, 4, 0.21)], [])
    expect(r.confidence).toBe('low')
  })

  it('ignores unknown-role hints (simulator) and falls back to first speaker without rms', () => {
    const r = pickWearer([u(1, 0, 1), u(0, 1, 2)], [{ start: 0, end: 2, role: 'unknown' }])
    expect(r).toEqual({ wearer: 1, method: 'first-speaker', confidence: 'low' })
  })
})
