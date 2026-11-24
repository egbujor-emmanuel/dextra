/**
 * Commitment-extraction eval (PRD §9). Runs the REAL extractor (Groq free tier, or Claude if configured) and the REAL core validator over
 * labelled conversations in evals/commitments.json and writes evidence/eval-commitments.json.
 * Usage: npm run eval -w @dextra/server   (free with GROQ_API_KEY)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeForMatch, validateProposal, type Utterance } from '@dextra/core'
import { ClaudeExtractor, GroqExtractor } from './extract'
import { loadEnv } from './env'

interface EvalCase {
  id: string
  utterances: [number, string][]
  expected: [number, string][]
}

const PACE_MS = 6000
const ROOT = resolve(import.meta.dirname, '../../..')

function toUtterances(rows: [number, string][]): Utterance[] {
  return rows.map(([speaker, text], i) => ({ speaker, start: i * 3, end: i * 3 + 2.5, text }))
}

async function main(): Promise<void> {
  const env = loadEnv()
  const extractor = env.GROQ_API_KEY || !env.ANTHROPIC_API_KEY ? new GroqExtractor(env.GROQ_API_KEY, env.GROQ_MODEL) : new ClaudeExtractor(env.ANTHROPIC_API_KEY)
  const { cases } = JSON.parse(readFileSync(resolve(ROOT, 'evals/commitments.json'), 'utf8')) as { cases: EvalCase[] }
  let tp = 0, fp = 0, fn = 0, unsupportedProposed = 0, unsupportedPassed = 0
  const rows: unknown[] = []
  for (const c of cases) {
    const utterances = toUtterances(c.utterances)
    const proposal = await extractor.propose(utterances)
    const result = validateProposal(proposal, utterances, 0)
    unsupportedProposed += result.dropped.length
    const kept = result.commitments
    const matched = new Set<number>()
    for (const [speaker, keyword] of c.expected) {
      const hit = kept.findIndex((k, i) => !matched.has(i) && k.speaker === speaker && normalizeForMatch(k.what).includes(normalizeForMatch(keyword)))
      if (hit >= 0) { matched.add(hit); tp++ } else fn++
    }
    fp += kept.length - matched.size
    // A kept commitment must always be backed by its speaker's words (the gate's invariant).
    unsupportedPassed += kept.filter(k => !normalizeForMatch(c.utterances.filter(([s]) => s === k.speaker).map(([, t]) => t).join(' ')).includes(normalizeForMatch(k.quote))).length
    rows.push({ id: c.id, expected: c.expected.length, kept: kept.map(k => [k.speaker, k.what]), dropped: result.dropped.length })
    console.info(`${c.id}: kept ${kept.length}, expected ${c.expected.length}, dropped ${result.dropped.length}`)
    await new Promise(r => setTimeout(r, PACE_MS)) // stay under the free tier per-minute token cap
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const summary = { model: env.GROQ_API_KEY ? env.GROQ_MODEL : 'claude-opus-5-5', cases: cases.length, tp, fp, fn, precision, recall, unsupportedProposed, unsupportedPassed, ranAt: new Date().toISOString(), rows }
  mkdirSync(resolve(ROOT, 'evidence'), { recursive: true })
  writeFileSync(resolve(ROOT, 'evidence/eval-commitments.json'), JSON.stringify(summary, null, 2))
  console.info(`precision ${precision.toFixed(2)} recall ${recall.toFixed(2)} · invented-by-LLM ${unsupportedProposed} · invented-that-got-through ${unsupportedPassed}`)
}

void main()
