import * as chrono from 'chrono-node'

function isoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Deterministic due-date resolution (the LLM never computes dates).
 * Weekday names resolve forward from the capture time. Returns YYYY-MM-DD or undefined.
 */
export function resolveDue(dueText: string | undefined, referenceISO: string): string | undefined {
  if (!dueText) return undefined
  const ref = new Date(referenceISO)
  const results = chrono.parse(dueText, { instant: ref, timezone: 0 }, { forwardDate: true })
  const first = results[0]
  if (!first) return undefined
  return isoDate(first.start.date())
}
