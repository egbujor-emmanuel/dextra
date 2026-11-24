import type { RoleHint, Utterance } from './types'

export interface WearerPick {
  wearer: number
  method: 'speakerRole' | 'loudness' | 'first-speaker'
  confidence: 'high' | 'low'
}

/** Loudness ratio below which we refuse to call it "high" confidence. */
const LOUDNESS_MARGIN = 1.5

export function speakerCount(utterances: Utterance[]): number {
  return new Set(utterances.map(u => u.speaker)).size
}

/**
 * Voice separation fails on short clips (verified: Deepgram nova-2/nova-3 label a 10 s two-person exchange as one
 * speaker). Then the LLM's proposed per-line turns are used, but only if well-formed: one 0/1 per line and both
 * people present. Real voice labels are never overridden. The result is marked `inferred` so the lens can say so.
 */
export function relabelByTurns(utterances: Utterance[], turns: number[] | undefined): { utterances: Utterance[]; inferred: boolean } {
  if (speakerCount(utterances) >= 2) return { utterances, inferred: false }
  const valid = turns !== undefined && turns.length === utterances.length && turns.every(t => t === 0 || t === 1) && new Set(turns).size === 2
  if (!valid) return { utterances, inferred: false }
  return { utterances: utterances.map((u, i) => ({ ...u, speaker: turns[i]! })), inferred: true }
}

function overlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

function bySelfHints(utterances: Utterance[], hints: RoleHint[]): number | undefined {
  const selfHints = hints.filter(h => h.role === 'self')
  if (selfHints.length === 0) return undefined
  const score = new Map<number, number>()
  for (const u of utterances) {
    const s = selfHints.reduce((sum, h) => sum + overlap(u, h), 0)
    score.set(u.speaker, (score.get(u.speaker) ?? 0) + s)
  }
  const [best] = [...score.entries()].sort((x, y) => y[1] - x[1])
  return best && best[1] > 0 ? best[0] : undefined
}

function meanLoudness(utterances: Utterance[]): Map<number, number> {
  const acc = new Map<number, { sum: number; dur: number }>()
  for (const u of utterances) {
    if (u.rms === undefined) continue
    const dur = Math.max(0.01, u.end - u.start)
    const cur = acc.get(u.speaker) ?? { sum: 0, dur: 0 }
    acc.set(u.speaker, { sum: cur.sum + u.rms * dur, dur: cur.dur + dur })
  }
  return new Map([...acc].map(([k, v]) => [k, v.sum / v.dur]))
}

/**
 * Which diarized speaker is the wearer?
 * 1) G2 speakerRole=self hints (real hardware only). 2) Loudest speaker (the mic sits on the wearer's head).
 * 3) First speaker, low confidence. The lens always lets the wearer swap (PRD §3 step 5).
 */
export function pickWearer(utterances: Utterance[], hints: RoleHint[]): WearerPick {
  const hinted = bySelfHints(utterances, hints)
  if (hinted !== undefined) return { wearer: hinted, method: 'speakerRole', confidence: 'high' }

  const loud = [...meanLoudness(utterances).entries()].sort((x, y) => y[1] - x[1])
  if (loud.length >= 1 && loud[0]) {
    const [top, second] = loud
    const confident = !second || top[1] >= second[1] * LOUDNESS_MARGIN
    return { wearer: top[0], method: 'loudness', confidence: confident ? 'high' : 'low' }
  }

  return { wearer: utterances[0]?.speaker ?? 0, method: 'first-speaker', confidence: 'low' }
}
