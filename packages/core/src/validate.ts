import { z } from 'zod'
import type { Commitment, Party, RefusalCode, Utterance } from './types'

/** Shape the LLM must return. The LLM only *proposes*; validateProposal decides. */
export const proposalSchema = z.object({
  counterpartyName: z.string().trim().min(1).max(60).optional(),
  commitments: z
    .array(
      z.object({
        speaker: z.number().int().min(0),
        what: z.string().trim().min(1).max(120),
        due_text: z.string().trim().max(60).optional(),
        amount: z.string().trim().max(40).optional(),
        quote: z.string().trim().min(3).max(300),
      }),
    )
    .max(8),
  /** Per transcript line, which of the two people said it (0 or 1). Used only when voice separation failed. */
  turns: z.array(z.number().int().min(0).max(1)).max(80).optional(),
})

export type Proposal = z.infer<typeof proposalSchema>

export interface ValidatedCommitment extends Omit<Commitment, 'id' | 'done' | 'dueISO'> {
  speaker: number
}

export interface ValidationResult {
  counterpartyName?: string
  commitments: ValidatedCommitment[]
  dropped: { what: string; code: RefusalCode }[]
  refusal?: RefusalCode
}

/** Lowercase, drop punctuation (keep letters/digits/whitespace in any script), collapse whitespace. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A quote must be specific enough that it can't match by accident. */
const MIN_QUOTE_WORDS = 2
const MIN_QUOTE_CHARS = 10
/** Words that carry no commitment on their own; a quote made only of these is filler ("ok sure", "yes the"). */
const FILLER = new Set(['yes', 'yeah', 'yep', 'no', 'ok', 'okay', 'sure', 'fine', 'deal', 'right', 'the', 'a', 'an', 'and', 'so', 'i', 'you', 'it', 'that', 'is', 'will', 'can', 'do', 'go', 'ahead', 'great', 'thanks', 'good'])

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 }

/** Numbers spoken as words in normalised text ("two thousand five hundred" → 2500, "half" is ignored). */
function spokenNumbers(normalised: string): string[] {
  const out: number[] = []
  let total = 0, current = 0, active = false
  const flush = () => { if (active) out.push(total + current); total = 0; current = 0; active = false }
  for (const w of normalised.split(' ')) {
    if (w in UNITS) { current += UNITS[w]!; active = true }
    else if (w === 'hundred' && active) current *= 100
    else if (w in SCALES && active) { total += current * SCALES[w]!; current = 0 }
    else if (w !== 'and') flush()
  }
  flush()
  return out.map(String)
}
/** Shapes an injected instruction would need (links, handles); never part of a genuine spoken commitment. */
const INJECTION_SHAPE = /(https?:|www\.|\.[a-z]{2,6}\b\/?|@\w)/i

function spokenBy(utterances: Utterance[], speaker?: number): string {
  return normalizeForMatch(utterances.filter(u => speaker === undefined || u.speaker === speaker).map(u => u.text).join(' '))
}

/** Word-boundary containment on normalised text ("send the deck" does not match "resend the deckhand"). */
function containsPhrase(haystack: string, needle: string): boolean {
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `)
}

function digitsOf(text: string): string[] {
  return (text.replace(/(\d),(\d)/g, '$1$2').match(/\d+/g) ?? []).filter(d => d.length > 0)
}

function supported(c: Proposal['commitments'][number], utterances: Utterance[]): boolean {
  const quote = normalizeForMatch(c.quote)
  const words = quote.split(' ')
  if (words.length < MIN_QUOTE_WORDS || quote.length < MIN_QUOTE_CHARS || words.every(w => FILLER.has(w))) return false
  if (!containsPhrase(spokenBy(utterances, c.speaker), quote)) return false
  if (INJECTION_SHAPE.test(c.what) || (c.amount && INJECTION_SHAPE.test(c.amount))) return false
  // Every number in the amount must have been spoken by someone, as digits or as words.
  const everyone = spokenBy(utterances)
  const spoken = new Set([...digitsOf(everyone), ...spokenNumbers(everyone)])
  return digitsOf(c.amount ?? '').every(d => spoken.has(d))
}

/**
 * Deterministic gate over an LLM proposal (PRD §6):
 * a commitment survives only if its quote appears verbatim (after normalisation)
 * in what the attributed speaker actually said.
 */
export function validateProposal(raw: unknown, utterances: Utterance[], wearerSpeaker: number): ValidationResult {
  const parsed = proposalSchema.safeParse(raw)
  if (!parsed.success) return { commitments: [], dropped: [], refusal: 'MALFORMED_PROPOSAL' }

  const kept: ValidatedCommitment[] = []
  const dropped: ValidationResult['dropped'] = []
  for (const c of parsed.data.commitments) {
    if (!supported(c, utterances)) {
      dropped.push({ what: c.what, code: 'UNSUPPORTED_BY_TRANSCRIPT' })
      continue
    }
    const by: Party = c.speaker === wearerSpeaker ? 'wearer' : 'counterparty'
    kept.push({ speaker: c.speaker, by, what: c.what, quote: c.quote, dueText: c.due_text, amount: c.amount })
  }

  return {
    counterpartyName: parsed.data.counterpartyName,
    commitments: kept,
    dropped,
    ...(kept.length === 0 ? { refusal: 'NO_COMMITMENT' as const } : {}),
  }
}
