import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { proposalSchema, type Commitment, type Proposal, type Utterance } from '@dextra/core'
import { notConfigured, ServiceError } from './errors'

const MODEL = 'claude-opus-5-5'

/** Proposals for an amendment: changes to existing commitments by index, never new obligations. */
export const amendmentSchema = z.object({
  changes: z
    .array(
      z.object({
        index: z.number().int().min(0),
        what: z.string().trim().min(1).max(120).optional(),
        due_text: z.string().trim().max(60).optional(),
        amount: z.string().trim().max(40).optional(),
        remove: z.boolean().optional(),
      }),
    )
    .max(8),
})
export type Amendment = z.infer<typeof amendmentSchema>

export interface Extractor {
  propose(utterances: Utterance[]): Promise<Proposal>
  /** Role labels only (no Telegram names reach the LLM: Bot Developer ToS 5.4). */
  amend(commitments: Commitment[], note: string): Promise<Amendment>
}

const LLM_TIMEOUT_MS = 30_000

const EXTRACT_SYSTEM = `You read a short transcript of two people talking face to face and list the concrete commitments they agreed to.
The transcript has numbered lines. Each line was said by one of the two people.
First decide who said each line and return "turns": one number per line, in order, 0 or 1. If the transcript says the voice labels are reliable, copy them. If it says they are unreliable, infer the turns from the conversation itself: questions and their answers usually come from different people, and "I will…" / "you will…" tell you who owes what. Person 0 is whoever speaks first.
A commitment is something one person said they will do, deliver, pay or decide, usually with a time. Include only commitments that person clearly accepted.
Terms count too: when one person states what will be delivered ("So it's three screens, done by the fifteenth") and the other accepts ("Agreed"), that is a commitment owed by whoever does the work.
For each commitment give: "speaker" (the person, using the same 0/1 numbers as "turns") who owes it; "what" as a short verb phrase (max 8 words, lowercase) that does not start with the owner's name but keeps the names of other people and the things involved ("loop in dana", "intro to sara", "deliver three screens"), and replaces "it"/"that" with the thing it refers to ("send the contract", not "send it"); "due_text" copied from how the deadline was said, if any; "amount" if money or a quantity was named; and "quote": the shortest exact words from that person's own lines that state the commitment, copied verbatim.
counterpartyName: the other person's first name if anyone says it, otherwise omit it.
If nobody committed to anything, return an empty list. Never invent or merge commitments that were not said.`

const AMEND_SYSTEM = `A person was asked to confirm a list of commitments from a conversation and replied with a correction instead.
Turn their correction into changes to the existing numbered commitments: a new "what", a new "due_text" (copied from their words), a new "amount", or remove=true.
Only change what the correction asks to change. Do not add new commitments.`

/**
 * Numbered lines with voice labels. Speech can't forge a turn: label look-alikes and line breaks are stripped.
 * When voice separation found fewer than two speakers, the labels are declared unreliable so turns are inferred.
 */
function transcriptText(utterances: Utterance[]): string {
  const clean = (t: string) => t.replace(/\[\s*(line|speaker|voice)[^\]]*\]/gi, '').replace(/[\r\n]+/g, ' ').trim()
  const reliable = new Set(utterances.map(u => u.speaker)).size >= 2
  const lines = utterances.map((u, i) => `[line ${i} | voice ${u.speaker}] ${clean(u.text)}`).join('\n')
  return `Voice labels are ${reliable ? 'reliable' : 'unreliable (voice separation failed on this short clip)'}.\n<transcript>\n${lines}\n</transcript>`
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_RETRY_WAIT_S = 12

/**
 * Free path (zero budget): Groq's free tier, no card needed (openai/gpt-oss-120b: 1,000 requests/day, json_schema output).
 * Output is still validated by zod here and gated by @dextra/core validateProposal: the model only proposes.
 */
export class GroqExtractor implements Extractor {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async parse<T>(system: string, user: string, schema: z.ZodType<T>, name: string): Promise<T> {
    if (!this.apiKey) throw notConfigured('LLM', 'GROQ_API_KEY')
    const body = JSON.stringify({
      model: this.model,
      temperature: 0,
      // gpt-oss models think before answering; low effort keeps the free per-minute token budget and latency down.
      ...(this.model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      messages: [
        { role: 'system', content: `${system}\nReply with JSON only, matching the provided schema.` },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, schema: z.toJSONSchema(schema) } },
    })
    const send = () =>
      this.fetchImpl(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      }).catch(() => {
        throw new ServiceError('EXTRACTION_FAILED', 'The AI step timed out. Try locking again.', 504)
      })
    let res = await send()
    if (res.status === 429) {
      // Free tier per-minute cap: wait as asked (bounded) and retry once.
      const asked = Number(res.headers.get('retry-after'))
      const wait = Math.min(res.headers.has('retry-after') && Number.isFinite(asked) && asked >= 0 ? asked : 5, MAX_RETRY_WAIT_S)
      await new Promise(r => setTimeout(r, wait * 1000))
      res = await send()
    }
    if (res.status === 429) throw new ServiceError('RATE_LIMITED', 'The free AI quota is busy. Try again in a minute.', 429)
    if (!res.ok) throw new ServiceError('EXTRACTION_FAILED', 'Could not read commitments from that conversation. Try locking again.', 502)
    const out = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    try {
      const parsed = schema.safeParse(JSON.parse(out.choices?.[0]?.message?.content ?? ''))
      if (parsed.success) return parsed.data
    } catch {
      // fall through to the typed refusal below
    }
    throw new ServiceError('EXTRACTION_FAILED', 'Could not read commitments from that conversation. Try locking again.', 502)
  }

  propose(utterances: Utterance[]): Promise<Proposal> {
    return this.parse(EXTRACT_SYSTEM, transcriptText(utterances), proposalSchema, 'commitments')
  }

  amend(commitments: Commitment[], note: string): Promise<Amendment> {
    return this.parse(AMEND_SYSTEM, amendPrompt(commitments, note), amendmentSchema, 'amendment')
  }
}

function amendPrompt(commitments: Commitment[], note: string): string {
  const list = commitments.map((c, i) => `${i}. ${c.by === 'wearer' ? 'Wearer' : 'Other person'}: ${c.what}${c.dueText ? ` (due: ${c.dueText})` : ''}${c.amount ? ` [${c.amount}]` : ''}`).join('\n')
  return `<commitments>\n${list}\n</commitments>\n\n<correction from="Other person">\n${note.replace(/<\/?correction[^>]*>/gi, '')}\n</correction>`
}

/** Optional paid path, used only when ANTHROPIC_API_KEY is set. Same gate applies. */
export class ClaudeExtractor implements Extractor {
  private readonly client?: Anthropic

  constructor(apiKey: string | undefined) {
    if (apiKey) this.client = new Anthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 1 })
  }

  private async parse<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
    if (!this.client) throw notConfigured('LLM', 'ANTHROPIC_API_KEY')
    const response = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: user }],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new ServiceError('EXTRACTION_FAILED', 'Could not read commitments from that conversation. Try locking again.', 502)
    }
    return response.parsed_output
  }

  propose(utterances: Utterance[]): Promise<Proposal> {
    return this.parse(EXTRACT_SYSTEM, transcriptText(utterances), proposalSchema)
  }

  amend(commitments: Commitment[], note: string): Promise<Amendment> {
    return this.parse(AMEND_SYSTEM, amendPrompt(commitments, note), amendmentSchema)
  }
}
