import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import type { Agreement } from './types'

/** JSON with object keys sorted recursively; arrays keep their order. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`
}

/** Hash of exactly what both parties agreed: parties + commitments (not history, status or timestamps of events). */
export function agreementHash(a: Agreement): string {
  const agreed = {
    id: a.id,
    wearerTgId: a.wearerTgId,
    counterpartyTgId: a.counterpartyTgId,
    commitments: a.commitments.map(c => ({ by: c.by, what: c.what, dueISO: c.dueISO, amount: c.amount, quote: c.quote })),
  }
  return bytesToHex(sha256(utf8ToBytes(canonicalJSON(agreed))))
}
