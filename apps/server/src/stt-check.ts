/**
 * Live check of the speech path (PRD §11 gate K-dg): joins evals/audio/part*.wav (a synthetic two-voice test
 * conversation made with Windows' built-in voices) into one 16 kHz clip, sends it through the REAL Deepgram
 * transcriber, then runs loudness + wearer attribution. Usage: node --env-file=.env --import tsx src/stt-check.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pickWearer, speakerCount } from '@dextra/core'
import { loadEnv } from './env'
import { DeepgramTranscriber } from './stt'
import { parseWav, withLoudness } from './wav'

const DIR = resolve(import.meta.dirname, '../../../evals', process.argv[2] ?? 'audio')
const GAP_SAMPLES = 16000 * 0.4

function joinParts(): Uint8Array {
  const parts = readdirSync(DIR).filter(f => /^part\d+\.wav$/.test(f)).sort().map(f => parseWav(new Uint8Array(readFileSync(resolve(DIR, f)))))
  const total = parts.reduce((n, p) => n + p.samples.length + GAP_SAMPLES, 0)
  const samples = new Int16Array(total)
  let at = 0
  for (const p of parts) { samples.set(p.samples, at); at += p.samples.length + GAP_SAMPLES }
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const s = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  s(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true)
  v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, samples.length * 2, true)
  samples.forEach((x, i) => v.setInt16(44 + i * 2, x, true))
  return new Uint8Array(buf)
}

async function main(): Promise<void> {
  const env = loadEnv()
  const wav = joinParts()
  writeFileSync(resolve(DIR, 'conversation.wav'), wav)
  const t0 = performance.now()
  const utterances = withLoudness(await new DeepgramTranscriber(env.DEEPGRAM_API_KEY).transcribe(wav), parseWav(wav))
  const ms = Math.round(performance.now() - t0)
  for (const u of utterances) console.info(`[speaker ${u.speaker}] ${u.start.toFixed(1)}-${u.end.toFixed(1)}s rms=${(u.rms ?? 0).toFixed(3)}  ${u.text}`)
  console.info(`speakers=${speakerCount(utterances)} wearer=${JSON.stringify(pickWearer(utterances, []))} deepgram_ms=${ms}`)
}

void main()
