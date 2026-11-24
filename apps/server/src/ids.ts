import { createHash, randomBytes, randomInt } from 'node:crypto'

export const newId = (prefix: string): string => `${prefix}_${randomBytes(9).toString('base64url')}`
export const newToken = (): string => randomBytes(32).toString('base64url')
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** 8 chars from an alphabet without look-alikes (no 0/O, 1/I/L): 31^8 ≈ 8.5e11 combinations. */
const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PAIR_LENGTH = 8
export function newPairCode(): string {
  return Array.from({ length: PAIR_LENGTH }, () => PAIR_ALPHABET[randomInt(PAIR_ALPHABET.length)]).join('')
}

/** Display names come from Telegram users; bound length and strip control characters before showing or storing. */
export function safeName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').trim().slice(0, 40) || 'them'
}
