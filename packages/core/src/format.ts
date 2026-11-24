import type { Commitment } from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "2026-11-27" → "Fri 27 Nov" (UTC calendar date; no timezone drift). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** Truncate to `max` chars with an ellipsis (the lens font is proportional; budgets are conservative). */
export function fitLine(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** One lens line: "Omar ▸ send the deck · Fri 27 Nov". */
export function commitmentLine(c: Pick<Commitment, 'by' | 'what' | 'dueISO' | 'amount'>, counterpartyName: string): string {
  const who = c.by === 'wearer' ? 'You' : counterpartyName
  const parts = [`${who} ▸ ${c.what}`]
  if (c.amount) parts.push(c.amount)
  if (c.dueISO) parts.push(shortDate(c.dueISO))
  return parts.join(' · ')
}
