/** Typed refusal surfaced to the glasses as `{ refusal, message }`. Messages are written for the lens. */
export class ServiceError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message)
    this.name = 'ServiceError'
  }
}

export const notConfigured = (what: string, envVar: string) =>
  new ServiceError(`${what}_NOT_CONFIGURED`, `The server is missing ${envVar}. Ask the operator to set it.`, 503)
