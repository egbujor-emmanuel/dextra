import { describe, expect, it } from 'vitest'
import { Db } from '../src/db'
import { createApp } from '../src/http'
import { Hub } from '../src/hub'
import { AgreementService } from '../src/service'
import { parseDeepgram } from '../src/stt'
import { parseWav, withLoudness } from '../src/wav'

function wav(samples: number[], rate = 16000): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const s = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  s(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, samples.length * 2, true)
  samples.forEach((x, i) => v.setInt16(44 + i * 2, x, true))
  return new Uint8Array(buf)
}

describe('wav', () => {
  it('parses PCM16 mono and measures per-utterance loudness', () => {
    const pcm = parseWav(wav([...Array(4).fill(16384), ...Array(4).fill(0)], 4))
    expect(pcm.sampleRate).toBe(4)
    const [loud, quiet] = withLoudness([{ speaker: 0, start: 0, end: 1, text: 'a' }, { speaker: 1, start: 1, end: 2, text: 'b' }], pcm)
    expect(loud!.rms).toBeCloseTo(0.5, 3)
    expect(quiet!.rms).toBe(0)
  })

  it('rejects non-WAV input', () => {
    expect(() => parseWav(new Uint8Array(60))).toThrow()
  })
})

describe('parseDeepgram', () => {
  it('maps diarized utterances and drops empty ones', () => {
    const out = parseDeepgram({ results: { utterances: [{ start: 0, end: 1, transcript: 'Deal.', speaker: 1 }, { start: 1, end: 2, transcript: ' ', speaker: 0 }] } })
    expect(out).toEqual([{ speaker: 1, start: 0, end: 1, text: 'Deal.' }])
  })

  it('throws a typed error on unexpected shapes', () => {
    expect(() => parseDeepgram({ nope: true })).toThrow(/unexpected shape/)
  })
})

describe('http', () => {
  const service = new AgreementService({
    db: new Db(':memory:'),
    hub: new Hub(),
    transcriber: { transcribe: async () => [] },
    extractor: { propose: async () => ({ commitments: [] }), amend: async () => ({ changes: [] }) },
    messenger: { sendAgreementCard: async () => undefined, postChecklist: async () => ({ messageId: 1 }), notify: async () => undefined },
    botUsername: 'DextraBot',
  })
  const app = createApp(service, new Hub())

  it('answers CORS preflight for the WebView', async () => {
    const res = await app.request('/api/captures', { method: 'OPTIONS', headers: { Origin: 'https://example.app', 'Access-Control-Request-Method': 'POST' } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('returns the typed refusal envelope for unauthenticated calls', async () => {
    const res = await app.request('/api/devices/me/state')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ refusal: 'UNAUTHORIZED', message: 'This device is not registered.' })
  })

  it('registers a device and reads its state', async () => {
    const reg = (await (await app.request('/api/devices', { method: 'POST' })).json()) as { deviceToken: string }
    const res = await app.request('/api/devices/me/state', { headers: { Authorization: `Bearer ${reg.deviceToken}` } })
    expect(await res.json()).toEqual({ paired: false, businessConnected: false, open: 0, dueSoon: 0 })
  })

  it('refuses oversized audio before doing any work', async () => {
    const reg = (await (await app.request('/api/devices', { method: 'POST' })).json()) as { deviceToken: string }
    const res = await app.request('/api/captures', { method: 'POST', headers: { Authorization: `Bearer ${reg.deviceToken}` }, body: new Uint8Array(3 * 1024 * 1024) })
    expect(res.status).toBe(413)
  })
})

import { attributeSpeakers } from '../src/wav'

describe('attributeSpeakers (voice pitch fallback)', () => {
  const RATE = 16000
  function voiced(hz: number, seconds: number): number[] {
    return Array.from({ length: Math.round(seconds * RATE) }, (_, i) => Math.round(0.3 * 32767 * (Math.sin(2 * Math.PI * hz * (i / RATE)) + 0.5 * Math.sin(4 * Math.PI * hz * (i / RATE))) / 1.5))
  }

  it('splits a one-voice transcript into two people when pitches are clearly apart', () => {
    const samples = new Int16Array([...voiced(115, 1), ...voiced(210, 1), ...voiced(205, 1), ...voiced(120, 1)])
    const pcm = { sampleRate: RATE, samples }
    const heard = [0, 1, 2, 3].map(i => ({ speaker: 0, start: i, end: i + 1, text: `line ${i}` }))
    const out = attributeSpeakers(heard, pcm)
    expect(out.attribution).toBe('pitch')
    expect(out.utterances.map(u => u.speaker)).toEqual([0, 1, 1, 0])
  })

  it('keeps real voice separation untouched', () => {
    const heard = [{ speaker: 0, start: 0, end: 1, text: 'a' }, { speaker: 1, start: 1, end: 2, text: 'b' }]
    expect(attributeSpeakers(heard, { sampleRate: RATE, samples: new Int16Array(RATE * 2) }).attribution).toBe('voice')
  })

  it('reports none when voices are too similar (LLM turns are the last resort)', () => {
    const samples = new Int16Array([...voiced(120, 1), ...voiced(125, 1), ...voiced(122, 1)])
    const heard = [0, 1, 2].map(i => ({ speaker: 0, start: i, end: i + 1, text: `l${i}` }))
    expect(attributeSpeakers(heard, { sampleRate: RATE, samples }).attribution).toBe('none')
  })
})
