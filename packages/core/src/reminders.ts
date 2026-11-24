import type { Agreement } from './types'

export type ReminderKind = 'tomorrow' | 'today' | 'overdue'

export interface DueReminder {
  commitmentId: string
  kind: ReminderKind
  /** 'owner': only whoever owes it; 'both': the record is overdue, so both people hear about it. */
  to: 'owner' | 'both'
}

/** Earliest UTC hour for each nudge, so nobody is pinged at midnight. */
const TOMORROW_FROM_HOUR = 8
const TODAY_FROM_HOUR = 6
/** No "due today/tomorrow" ping right after the agreement was confirmed: they just said it out loud. */
const QUIET_AFTER_CONFIRM_MS = 3 * 60 * 60_000
const DAY_MS = 24 * 60 * 60_000

const dayOf = (iso: string): string => iso.slice(0, 10)
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** Key used to remember that a reminder went out, so it is never sent twice. */
export const reminderKey = (commitmentId: string, kind: ReminderKind): string => `${commitmentId}:${kind}`

/**
 * Which reminders are due now for a confirmed agreement. Pure and deterministic (dates are UTC calendar days):
 * the day before (from 08:00) → owner; on the day (from 06:00) → owner; after the day → both, once.
 * Only the most advanced applicable nudge is returned, and nothing already in `sent`.
 */
export function dueReminders(a: Agreement, nowISO: string, sent: ReadonlySet<string>): DueReminder[] {
  if (a.status !== 'confirmed') return []
  const today = dayOf(nowISO)
  const hour = new Date(nowISO).getUTCHours()
  const confirmedAt = [...a.history].reverse().find(h => h.event === 'confirm' || h.event === 'accept')?.at
  const justConfirmed = confirmedAt !== undefined && Date.parse(nowISO) - Date.parse(confirmedAt) < QUIET_AFTER_CONFIRM_MS
  const out: DueReminder[] = []
  for (const c of a.commitments) {
    if (c.done || !c.dueISO) continue
    const due = dayOf(c.dueISO)
    let kind: ReminderKind | undefined
    if (today > due) kind = 'overdue'
    else if (today === due && hour >= TODAY_FROM_HOUR && !justConfirmed) kind = 'today'
    else if (today === addDays(due, -1) && hour >= TOMORROW_FROM_HOUR && !justConfirmed) kind = 'tomorrow'
    if (kind && !sent.has(reminderKey(c.id, kind))) out.push({ commitmentId: c.id, kind, to: kind === 'overdue' ? 'both' : 'owner' })
  }
  return out
}
