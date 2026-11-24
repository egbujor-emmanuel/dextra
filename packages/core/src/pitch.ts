import type { Utterance } from './types'

/** Human voice fundamental range searched (Hz). */
const MIN_HZ = 70
const MAX_HZ = 400
const FRAME_SECONDS = 0.04
/** Frames quieter than this (RMS, 0..1) are treated as silence. */
const SILENCE_RMS = 0.01
/** Normalised autocorrelation needed to call a frame voiced. */
const VOICED_CORRELATION = 0.6
/** A candidate period must reach this fraction of the best correlation to be accepted as the first peak. */
const PEAK_FRACTION = 0.9
/** Two voices count as "clearly apart" when their median pitches differ by at least this ratio (~4 semitones). */
const SEPARATION_RATIO = 1.25
const MIN_MEASURED = 3

function framePitch(frame: Float32Array, sampleRate: number): number | undefined {
  let energy = 0
  for (const s of frame) energy += s * s
  if (Math.sqrt(energy / frame.length) < SILENCE_RMS) return undefined
  const minLag = Math.floor(sampleRate / MAX_HZ)
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), frame.length - 1)
  const corr: number[] = []
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, a = 0, b = 0
    for (let i = 0; i + lag < frame.length; i++) {
      sum += frame[i]! * frame[i + lag]!
      a += frame[i]! * frame[i]!
      b += frame[i + lag]! * frame[i + lag]!
    }
    const r = sum / Math.sqrt(a * b || 1)
    corr.push(r)
    if (r > best) best = r
  }
  if (best < VOICED_CORRELATION) return undefined
  // A periodic signal also correlates at 2x, 3x its period (octave errors): take the FIRST local peak that is
  // nearly as strong as the best one, i.e. the shortest period.
  for (let i = 1; i < corr.length - 1; i++) {
    const r = corr[i]!
    if (r >= PEAK_FRACTION * best && r >= corr[i - 1]! && r >= corr[i + 1]!) return sampleRate / (minLag + i)
  }
  return undefined
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const s = [...values].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1]! + s[mid]!) / 2
}

/** Median fundamental frequency (Hz) over voiced frames, or undefined if nothing voiced. Pure autocorrelation. */
export function estimatePitch(samples: Int16Array, sampleRate: number): number | undefined {
  const size = Math.round(FRAME_SECONDS * sampleRate)
  const pitches: number[] = []
  for (let start = 0; start + size <= samples.length; start += size) {
    const frame = new Float32Array(size)
    for (let i = 0; i < size; i++) frame[i] = samples[start + i]! / 32768
    const p = framePitch(frame, sampleRate)
    if (p !== undefined) pitches.push(p)
  }
  return median(pitches)
}

/**
 * Two-person labels from per-sentence pitch, or undefined when the voices aren't clearly apart.
 * Splits at the largest gap between sorted pitches; person 0 is whoever speaks first; unmeasured lines inherit.
 */
export function labelByPitch(utterances: Utterance[], pitches: (number | undefined)[]): number[] | undefined {
  const measured = pitches.filter((p): p is number => p !== undefined)
  if (measured.length < MIN_MEASURED) return undefined
  const sorted = [...measured].sort((a, b) => a - b)
  let split = 0
  let widest = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! / sorted[i - 1]!
    if (gap > widest) { widest = gap; split = i }
  }
  const low = median(sorted.slice(0, split))
  const high = median(sorted.slice(split))
  if (low === undefined || high === undefined || high / low < SEPARATION_RATIO) return undefined
  const threshold = Math.sqrt(sorted[split - 1]! * sorted[split]!)
  const raw = pitches.map(p => (p === undefined ? undefined : p >= threshold ? 1 : 0))
  const firstGroup = raw.find(x => x !== undefined) ?? 0
  const labels: number[] = []
  for (let i = 0; i < utterances.length; i++) {
    const r = raw[i]
    labels.push(r === undefined ? (labels[i - 1] ?? 0) : r === firstGroup ? 0 : 1)
  }
  return labels
}
