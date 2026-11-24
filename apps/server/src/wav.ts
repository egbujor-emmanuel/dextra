import { estimatePitch, labelByPitch, speakerCount, type Utterance } from '@dextra/core'

export type Attribution = 'voice' | 'pitch' | 'none'

/**
 * Who said each line, from the audio itself: Deepgram's voice separation if it found two speakers; otherwise
 * per-sentence voice pitch when the two voices are clearly apart; otherwise 'none' (the LLM's turns are the last resort).
 */
export function attributeSpeakers(utterances: Utterance[], pcm: Pcm): { utterances: Utterance[]; attribution: Attribution } {
  if (speakerCount(utterances) >= 2) return { utterances, attribution: 'voice' }
  const pitches = utterances.map(u => {
    const from = Math.max(0, Math.floor(u.start * pcm.sampleRate))
    const to = Math.min(pcm.samples.length, Math.ceil(u.end * pcm.sampleRate))
    return to > from ? estimatePitch(pcm.samples.subarray(from, to), pcm.sampleRate) : undefined
  })
  const labels = labelByPitch(utterances, pitches)
  if (!labels) return { utterances, attribution: 'none' }
  return { utterances: utterances.map((u, i) => ({ ...u, speaker: labels[i]! })), attribution: 'pitch' }
}

export interface Pcm {
  sampleRate: number
  samples: Int16Array
}

/** Parse a PCM16 mono WAV (the format apps/glasses sends). Throws on anything else. */
export function parseWav(buf: Uint8Array): Pcm {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const tag = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!)
  if (buf.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file')
  let offset = 12
  let sampleRate = 0
  while (offset + 8 <= buf.byteLength) {
    const id = tag(offset)
    const size = v.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      const format = v.getUint16(offset + 8, true)
      const channels = v.getUint16(offset + 10, true)
      const bits = v.getUint16(offset + 22, true)
      if (format !== 1 || channels !== 1 || bits !== 16) throw new Error('expected PCM16 mono')
      sampleRate = v.getUint32(offset + 12, true)
    } else if (id === 'data') {
      const count = Math.floor(Math.min(size, buf.byteLength - offset - 8) / 2)
      const samples = new Int16Array(count)
      for (let i = 0; i < count; i++) samples[i] = v.getInt16(offset + 8 + i * 2, true)
      if (!sampleRate) throw new Error('missing fmt chunk')
      return { sampleRate, samples }
    }
    offset += 8 + size + (size % 2)
  }
  throw new Error('missing data chunk')
}

/** Mean RMS (0..1) of each utterance's time span. Feeds the "loudest speaker = wearer" heuristic. */
export function withLoudness(utterances: Utterance[], pcm: Pcm): Utterance[] {
  return utterances.map(u => {
    const from = Math.max(0, Math.floor(u.start * pcm.sampleRate))
    const to = Math.min(pcm.samples.length, Math.ceil(u.end * pcm.sampleRate))
    if (to <= from) return u
    let sum = 0
    for (let i = from; i < to; i++) {
      const s = (pcm.samples[i] ?? 0) / 32768
      sum += s * s
    }
    return { ...u, rms: Math.sqrt(sum / (to - from)) }
  })
}
