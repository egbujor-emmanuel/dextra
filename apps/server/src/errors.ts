/**
 * One-line description of an unexpected error for the server log: name, code (e.g. a libSQL or Telegram code) and
 * message, with any bot token redacted. Never includes request bodies or transcripts.
 */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, 200)
  const code = (e as { code?: unknown }).code
  return `${e.name}${code ? ` ${String(code)}` : ''}: ${e.message}`.replace(/bot\d+:[\w-]+/g, 'bot<redacted>').slice(0, 300)
}

/** Typed refusal surfaced to the glasses as `{ refusal, message }`. Messages are written for the lens. */
export class ServiceError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message)
    this.name = 'ServiceError'
  }
}

export const notConfigured = (what: string, envVar: string) =>
  new ServiceError(`${what}_NOT_CONFIGURED`, `The server is missing ${envVar}. Ask the operator to set it.`, 503)
