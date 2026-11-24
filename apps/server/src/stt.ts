import { z } from 'zod'
import type { Utterance } from '@dextra/core'
import { notConfigured, ServiceError } from './errors'

const STT_TIMEOUT_MS = 20_000
const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&smart_format=true&punctuate=true'

const wordSchema = z.object({
  word: z.string(),
  punctuated_word: z.string().optional(),
  start: z.number(),
  end: z.number(),
  speaker: z.number().int().optional(),
})

const deepgramSchema = z.object({
  results: z.object({
    channels: z.array(z.object({ alternatives: z.array(z.object({ words: z.array(wordSchema).default([]) })).default([]) })).default([]),
    utterances: z
      .array(z.object({ start: z.number(), end: z.number(), transcript: z.string(), speaker: z.number().int().optional() }))
      .default([]),
  }),
})

export interface Transcriber {
  transcribe(wav: Uint8Array): Promise<Utterance[]>
}

/** Deepgram pre-recorded STT with diarization. Audio is sent once and never stored by us. */
export class DeepgramTranscriber implements Transcriber {
  constructor(private readonly apiKey: string | undefined, private readonly fetchImpl: typeof fetch = fetch) {}

  async transcribe(wav: Uint8Array): Promise<Utterance[]> {
    if (!this.apiKey) throw notConfigured('STT', 'DEEPGRAM_API_KEY')
    const res = await this.fetchImpl(DEEPGRAM_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiKey}`, 'Content-Type': 'audio/wav' },
      body: wav,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    }).catch(() => {
      throw new ServiceError('STT_FAILED', 'Transcription timed out. Try locking again.', 504)
    })
    if (!res.ok) throw new ServiceError('STT_FAILED', `Transcription failed (${res.status}). Try locking again.`, 502)
    return parseDeepgram(await res.json())
  }
}

const SENTENCE_END = /[.?!]$/

/**
 * One turn per sentence (or per speaker change). Deepgram's utterances can merge two people's lines when
 * diarization misses on short clips, so sentences are the safest unit for later turn attribution.
 */
export function parseDeepgram(body: unknown): Utterance[] {
  const parsed = deepgramSchema.safeParse(body)
  if (!parsed.success) throw new ServiceError('STT_FAILED', 'Transcription came back in an unexpected shape.', 502)
  const words = parsed.data.results.channels[0]?.alternatives[0]?.words ?? []
  if (words.length === 0) {
    return parsed.data.results.utterances
      .filter(u => u.transcript.trim().length > 0)
      .map(u => ({ speaker: u.speaker ?? 0, start: u.start, end: u.end, text: u.transcript }))
  }
  const turns: Utterance[] = []
  let current: { speaker: number; start: number; end: number; parts: string[] } | undefined
  for (const w of words) {
    const speaker = w.speaker ?? 0
    const text = w.punctuated_word ?? w.word
    if (current && current.speaker !== speaker) {
      turns.push({ speaker: current.speaker, start: current.start, end: current.end, text: current.parts.join(' ') })
      current = undefined
    }
    current ??= { speaker, start: w.start, end: w.end, parts: [] }
    current.parts.push(text)
    current.end = w.end
    if (SENTENCE_END.test(text)) {
      turns.push({ speaker: current.speaker, start: current.start, end: current.end, text: current.parts.join(' ') })
      current = undefined
    }
  }
  if (current) turns.push({ speaker: current.speaker, start: current.start, end: current.end, text: current.parts.join(' ') })
  return turns
}
