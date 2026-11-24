import { describe, expect, it } from 'vitest'
import { GroqExtractor } from '../src/extract'

const utterances = [{ speaker: 1, start: 0, end: 2, text: 'Yes, the deck by Friday.' }]

function fakeFetch(status: number, content: string, seen?: { body?: unknown }): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    if (seen) seen.body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: status === 429 ? { 'retry-after': '0' } : {} })
  }) as unknown as typeof fetch
}

describe('GroqExtractor (free tier path)', () => {
  it('sends a json_schema request and returns the validated proposal', async () => {
    const seen: { body?: unknown } = {}
    const content = JSON.stringify({ counterpartyName: 'Omar', commitments: [{ speaker: 1, what: 'send the deck', due_text: 'Friday', quote: 'the deck by Friday' }] })
    const out = await new GroqExtractor('k', 'openai/gpt-oss-120b', fakeFetch(200, content, seen)).propose(utterances)
    expect(out.commitments[0]?.what).toBe('send the deck')
    const body = seen.body as { model: string; response_format: { type: string } }
    expect(body.model).toBe('openai/gpt-oss-120b')
    expect(body.response_format.type).toBe('json_schema')
  })

  it('refuses output that does not match the schema (never trusts the model)', async () => {
    await expect(new GroqExtractor('k', 'm', fakeFetch(200, '{"commitments":"nope"}')).propose(utterances)).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
    await expect(new GroqExtractor('k', 'm', fakeFetch(200, 'not json')).propose(utterances)).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })

  it('maps the free-tier rate limit to a typed refusal', async () => {
    await expect(new GroqExtractor('k', 'm', fakeFetch(429, '')).propose(utterances)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('reports a missing key as not configured', async () => {
    await expect(new GroqExtractor(undefined, 'm').propose(utterances)).rejects.toMatchObject({ code: 'LLM_NOT_CONFIGURED' })
  })
})
