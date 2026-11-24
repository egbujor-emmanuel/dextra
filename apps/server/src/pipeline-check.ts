/**
 * Live check of the full capture path without Telegram: evals/<dir>/conversation.wav → REAL Deepgram → REAL Groq
 * (commitments + per-line turns) → relabelByTurns → pickWearer → core gate. Usage:
 *   node --env-file=.env --import tsx src/pipeline-check.ts audio-kokoro
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { commitmentLine, pickWearer, relabelByTurns, validateProposal } from '@dextra/core'
import { loadEnv } from './env'
import { GroqExtractor } from './extract'
import { DeepgramTranscriber } from './stt'
import { attributeSpeakers, parseWav, withLoudness } from './wav'

async function main(): Promise<void> {
  const env = loadEnv()
  const wav = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../evals', process.argv[2] ?? 'audio-kokoro', 'conversation.wav')))
  const t0 = performance.now()
  const pcm = parseWav(wav)
  const raw = withLoudness(await new DeepgramTranscriber(env.DEEPGRAM_API_KEY).transcribe(wav), pcm)
  const { utterances: heard, attribution } = attributeSpeakers(raw, pcm)
  const t1 = performance.now()
  console.info(`attribution from audio: ${attribution}`)
  const proposal = await new GroqExtractor(env.GROQ_API_KEY, env.GROQ_MODEL).propose(heard)
  const t2 = performance.now()
  const { utterances, inferred } = relabelByTurns(heard, proposal.turns)
  const pick = pickWearer(utterances, [])
  utterances.forEach((u, i) => console.info(`line ${i} [deepgram ${raw[i]!.speaker} → person ${u.speaker}] ${u.text}`))
  const result = validateProposal(proposal, utterances, pick.wearer)
  console.info(`turns inferred: ${inferred} · wearer = person ${pick.wearer} (${pick.method}, ${pick.confidence})`)
  for (const c of result.commitments) console.info('  ✓', commitmentLine({ by: c.by, what: c.what, amount: c.amount }, 'Them'), `· due "${c.dueText ?? '-'}"`)
  for (const d of result.dropped) console.info('  ✗ dropped by gate:', d.what, d.code)
  console.info(`deepgram ${Math.round(t1 - t0)} ms · groq ${Math.round(t2 - t1)} ms · total ${Math.round(t2 - t0)} ms`)
}

void main()
