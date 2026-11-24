import { describe, expect, it } from 'vitest'
import { estimatePitch, labelByPitch } from '../src/pitch'
import type { Utterance } from '../src/types'

const RATE = 16000

function tone(hz: number, seconds: number, amp = 0.4): Int16Array {
  const n = Math.round(seconds * RATE)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    // fundamental + two harmonics, like a voiced vowel
    const t = i / RATE
    const v = Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * 2 * hz * t) + 0.25 * Math.sin(2 * Math.PI * 3 * hz * t)
    out[i] = Math.round((v / 1.75) * amp * 32767)
  }
  return out
}

describe('estimatePitch', () => {
  it('finds the fundamental of a voiced signal within a few percent', () => {
    expect(estimatePitch(tone(120, 0.5), RATE)!).toBeGreaterThan(114)
    expect(estimatePitch(tone(120, 0.5), RATE)!).toBeLessThan(126)
    expect(estimatePitch(tone(220, 0.5), RATE)!).toBeGreaterThan(209)
    expect(estimatePitch(tone(220, 0.5), RATE)!).toBeLessThan(231)
  })

  it('returns undefined for silence', () => {
    expect(estimatePitch(new Int16Array(8000), RATE)).toBeUndefined()
  })
})

describe('labelByPitch', () => {
  const u = (start: number, end: number): Utterance => ({ speaker: 0, start, end, text: 'x' })

  it('splits sentences into two people when voices are clearly apart (first speaker = person 0)', () => {
    const r = labelByPitch([u(0, 1), u(1, 2), u(2, 3), u(3, 4)], [118, 215, 205, 125])
    expect(r).toEqual([0, 1, 1, 0])
  })

  it('refuses when the voices are too close to tell apart', () => {
    expect(labelByPitch([u(0, 1), u(1, 2), u(2, 3)], [120, 128, 124])).toBeUndefined()
  })

  it('refuses when there are too few measurable sentences', () => {
    expect(labelByPitch([u(0, 1), u(1, 2)], [120, undefined])).toBeUndefined()
  })

  it('leaves unmeasurable sentences with the previous speaker', () => {
    expect(labelByPitch([u(0, 1), u(1, 2), u(2, 3), u(3, 4)], [120, undefined, 220, 230])).toEqual([0, 0, 1, 1])
  })
})
