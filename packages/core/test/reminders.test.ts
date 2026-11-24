import { describe, expect, it } from 'vitest'
import { dueReminders, reminderKey, type Agreement } from '../src'

const base: Agreement = {
  id: 'agr_1',
  createdAt: '2026-11-24T10:00:00.000Z',
  wearerTgId: 1,
  counterpartyTgId: 2,
  counterpartyName: 'Attrito',
  status: 'confirmed',
  history: [{ event: 'confirm', at: '2026-11-24T10:00:00.000Z', by: 2 }],
  commitments: [
    { id: 'c1', by: 'counterparty', what: 'send the deck', dueISO: '2026-11-27', quote: 'q', done: false },
    { id: 'c2', by: 'wearer', what: 'intro to Sarah', quote: 'q', done: false },
  ],
}
const none = new Set<string>()

describe('dueReminders', () => {
  it('nudges the owner the day before, from 08:00 UTC', () => {
    expect(dueReminders(base, '2026-11-26T07:59:00.000Z', none)).toEqual([])
    expect(dueReminders(base, '2026-11-26T08:00:00.000Z', none)).toEqual([{ commitmentId: 'c1', kind: 'tomorrow', to: 'owner' }])
  })

  it('nudges the owner on the day, then both people once it is overdue', () => {
    expect(dueReminders(base, '2026-11-27T06:30:00.000Z', none)).toEqual([{ commitmentId: 'c1', kind: 'today', to: 'owner' }])
    expect(dueReminders(base, '2026-11-28T00:05:00.000Z', none)).toEqual([{ commitmentId: 'c1', kind: 'overdue', to: 'both' }])
  })

  it('never repeats a reminder that already went out', () => {
    const sent = new Set([reminderKey('c1', 'tomorrow')])
    expect(dueReminders(base, '2026-11-26T12:00:00.000Z', sent)).toEqual([])
  })

  it('skips done items, items without a date, and records that are not open', () => {
    const done = { ...base, commitments: base.commitments.map(c => ({ ...c, done: true })) }
    expect(dueReminders(done, '2026-11-28T09:00:00.000Z', none)).toEqual([])
    expect(dueReminders({ ...base, status: 'fulfilled' }, '2026-11-28T09:00:00.000Z', none)).toEqual([])
    expect(dueReminders({ ...base, status: 'sent' }, '2026-11-28T09:00:00.000Z', none)).toEqual([])
  })

  it('stays quiet right after confirmation (they just said it out loud), but still flags overdue', () => {
    const justNow = { ...base, history: [{ event: 'confirm', at: '2026-11-27T09:00:00.000Z', by: 2 }] }
    expect(dueReminders(justNow, '2026-11-27T10:00:00.000Z', none)).toEqual([])
    expect(dueReminders(justNow, '2026-11-27T12:30:00.000Z', none)).toEqual([{ commitmentId: 'c1', kind: 'today', to: 'owner' }])
  })
})
