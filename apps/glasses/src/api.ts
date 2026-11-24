import {
  agreementViewSchema,
  captureResponseSchema,
  deviceRegisterResponseSchema,
  deviceStateSchema,
  pairCodeResponseSchema,
  serverEventSchema,
  type AgreementView,
  type CaptureResponse,
  type DeviceState,
  type ServerEvent,
} from '@dextra/core'
import { z } from 'zod'

/** The live server (Render, free plan) for packaged builds; a local server in development unless VITE_API_BASE says otherwise. */
const LIVE_API = 'https://dextra-qfz7.onrender.com'
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? (import.meta.env.PROD ? LIVE_API : 'http://localhost:8787')

export class ApiError extends Error {
  constructor(readonly status: number, readonly refusal: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Thin, typed client. Every response is validated against the shared contract. */
export class Api {
  constructor(private token = '') {}

  setToken(token: string): void {
    this.token = token
  }

  private async call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
    })
    const body: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const r = body as { refusal?: string; message?: string }
      throw new ApiError(res.status, r.refusal ?? 'SERVER_ERROR', r.message ?? `Server error ${res.status}`)
    }
    return schema.parse(body)
  }

  register(): Promise<{ deviceId: string; deviceToken: string }> {
    return this.call('/api/devices', deviceRegisterResponseSchema, { method: 'POST' })
  }

  pairCode(): Promise<{ code: string; expiresAt: string; botUsername: string }> {
    return this.call('/api/devices/me/pair-code', pairCodeResponseSchema, { method: 'POST' })
  }

  state(): Promise<DeviceState> {
    return this.call('/api/devices/me/state', deviceStateSchema)
  }

  capture(wav: Uint8Array): Promise<CaptureResponse> {
    return this.call('/api/captures', captureResponseSchema, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav })
  }

  /** `contactId` pins a send to the recipient the lens showed; the server refuses if they differ. */
  act(id: string, action: 'send' | 'discard' | 'accept' | 'reject' | 'swap' | 'next-contact', contactId?: string): Promise<AgreementView> {
    const q = contactId ? `?contact=${encodeURIComponent(contactId)}` : ''
    return this.call(`/api/agreements/${encodeURIComponent(id)}/${action}${q}`, agreementViewSchema, { method: 'POST' })
  }

  list(): Promise<AgreementView[]> {
    return this.call('/api/agreements', z.array(agreementViewSchema))
  }

  /**
   * Server-sent events. EventSource cannot send headers, so it uses a single-use 60 s ticket (never the device token).
   * On error the stream is closed and `onDrop` decides when to reconnect with a fresh ticket.
   */
  async events(onEvent: (e: ServerEvent) => void, onDrop: () => void): Promise<EventSource> {
    const { ticket } = await this.call('/api/devices/me/sse-ticket', z.object({ ticket: z.string() }), { method: 'POST' })
    const es = new EventSource(`${API_BASE}/api/devices/me/events?ticket=${encodeURIComponent(ticket)}`)
    es.onmessage = msg => {
      try {
        const parsed = serverEventSchema.safeParse(JSON.parse(String(msg.data)))
        if (parsed.success) onEvent(parsed.data)
      } catch {
        // malformed frame: ignore
      }
    }
    es.onerror = () => {
      es.close()
      onDrop()
    }
    return es
  }
}
