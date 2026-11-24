import { describe, expect, it } from 'vitest'
import { PcmRing, toWav } from '../src/audio'
import { frameFor } from '../src/screens'
import type { AgreementView } from '@dextra/core'

function bytesOf(samples: number[]): Uint8Array {
  const b = new Uint8Array(samples.length * 2)
  const v = new DataView(b.buffer)
  samples.forEach((s, i) => v.setInt16(i * 2, s, true))
  return b
}

describe('PcmRing', () => {
  it('keeps only the newest samples when full', () => {
    const ring = new PcmRing(1, 4) // capacity 4 samples
    ring.pushBytes(bytesOf([1, 2, 3]))
    expect([...ring.snapshot()]).toEqual([1, 2, 3])
    ring.pushBytes(bytesOf([4, 5, 6]))
    expect(ring.length).toBe(4)
    expect([...ring.snapshot()]).toEqual([3, 4, 5, 6])
  })

  it('clears to empty', () => {
    const ring = new PcmRing(1, 4)
    ring.pushBytes(bytesOf([9, 9]))
    ring.clear()
    expect(ring.length).toBe(0)
    expect(ring.snapshot()).toHaveLength(0)
  })
})

describe('toWav', () => {
  it('writes a valid PCM16 mono header', () => {
    const wav = toWav(new Int16Array([0, 1000, -1000]), 16000)
    const v = new DataView(wav.buffer)
    const text = (o: number) => String.fromCharCode(...wav.slice(o, o + 4))
    expect(text(0)).toBe('RIFF')
    expect(text(8)).toBe('WAVE')
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(16000)
    expect(v.getUint32(40, true)).toBe(6)
    expect(v.getInt16(46, true)).toBe(1000)
    expect(wav.length).toBe(50)
  })
})

const agreement: AgreementView = {
  id: 'a1',
  status: 'draft',
  counterpartyName: 'Omar',
  warnings: [],
  commitments: [
    { id: 'c1', by: 'counterparty', what: 'send the deck', dueISO: '2026-11-28', done: false, line: 'Omar ▸ send the deck · Fri 28 Nov' },
    { id: 'c2', by: 'wearer', what: 'intro to Sara', done: false, line: 'You ▸ intro to Sara' },
  ],
}

describe('frameFor', () => {
  it('review card shows both commitments and the one-tap action', () => {
    const f = frameFor({ kind: 'review', agreement })
    expect(f.header).toBe('Agreed with Omar?')
    expect(f.body).toBe('Omar ▸ send the deck · Fri 28 Nov\nYou ▸ intro to Sara')
    expect(f.footer).toContain('tap ▸ send to Omar')
  })

  it('confirmed card carries the motto', () => {
    expect(frameFor({ kind: 'confirmed', agreement: { ...agreement, status: 'confirmed' } }).body).toContain('Dictum, factum.')
  })

  it('amended card shows the counterparty version and their note', () => {
    const amended: AgreementView = {
      ...agreement,
      status: 'amended',
      amendNote: 'Monday, not Friday',
      proposed: [{ ...agreement.commitments[0]!, dueISO: '2026-12-01', line: 'Omar ▸ send the deck · Mon 1 Dec' }, agreement.commitments[1]!],
    }
    const f = frameFor({ kind: 'amended', agreement: amended })
    expect(f.body).toContain('Mon 1 Dec')
    expect(f.body).toContain('“Monday, not Friday”')
  })

  it('keeps every frame within the firmware text limit', () => {
    const long = { ...agreement, commitments: Array.from({ length: 8 }, (_, i) => ({ ...agreement.commitments[0]!, id: `c${i}`, line: 'x'.repeat(200) })) }
    const f = frameFor({ kind: 'review', agreement: long })
    expect(f.header.length + f.body.length + f.footer.length).toBeLessThan(1000)
    expect(f.body).toContain('+5 more')
  })

  it('idle tells an unconnected wearer exactly what to do', () => {
    const f = frameFor({ kind: 'idle', listening: true, seconds: 12, state: { paired: true, businessConnected: false, open: 0, dueSoon: 0 } })
    expect(f.body).toContain('● listening · last 12s')
    expect(f.footer).toContain('Chat Automation')
  })
})
