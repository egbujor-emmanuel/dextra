export const SAMPLE_RATE = 16_000
export const BUFFER_SECONDS = 45

/**
 * Fixed-size ring of 16-bit mono PCM held only in memory (PRD §3 step 1).
 * Writing past capacity overwrites the oldest samples; nothing is persisted.
 */
export class PcmRing {
  private readonly data: Int16Array
  private writePos = 0
  private filled = 0

  constructor(seconds = BUFFER_SECONDS, sampleRate = SAMPLE_RATE) {
    this.data = new Int16Array(seconds * sampleRate)
  }

  get capacity(): number {
    return this.data.length
  }

  get length(): number {
    return this.filled
  }

  /** Accepts the SDK's little-endian s16 bytes. */
  pushBytes(bytes: Uint8Array): void {
    const samples = Math.floor(bytes.length / 2)
    const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2)
    for (let i = 0; i < samples; i++) {
      this.data[this.writePos] = view.getInt16(i * 2, true)
      this.writePos = (this.writePos + 1) % this.data.length
    }
    this.filled = Math.min(this.data.length, this.filled + samples)
  }

  /** Oldest → newest copy of what is buffered. */
  snapshot(): Int16Array {
    const out = new Int16Array(this.filled)
    const start = (this.writePos - this.filled + this.data.length) % this.data.length
    for (let i = 0; i < this.filled; i++) out[i] = this.data[(start + i) % this.data.length] ?? 0
    return out
  }

  clear(): void {
    this.data.fill(0)
    this.writePos = 0
    this.filled = 0
  }
}

/** Loudness summary (0..1) for diagnostics. Numbers only: never the audio itself. */
export function levels(samples: Int16Array): { rms: number; peak: number } {
  let sum = 0
  let peak = 0
  for (const s of samples) {
    const v = Math.abs(s) / 32768
    sum += v * v
    if (v > peak) peak = v
  }
  return { rms: samples.length ? Math.sqrt(sum / samples.length) : 0, peak }
}

/** Minimal 44-byte RIFF/WAVE header + PCM16 mono payload. */
export function toWav(samples: Int16Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  ascii(36, 'data')
  v.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, samples[i] ?? 0, true)
  return new Uint8Array(buf)
}
