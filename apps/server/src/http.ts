import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { InvalidTransitionError, type ServerEvent } from '@dextra/core'
import { ServiceError } from './errors'
import type { Hub } from './hub'
import { newToken } from './ids'
import type { AgreementService } from './service'

const MAX_AUDIO_BYTES = 2 * 1024 * 1024 // 45 s of 16 kHz PCM16 ≈ 1.44 MB
const CAPTURES_PER_MINUTE_DEVICE = 6
const CAPTURES_PER_MINUTE_WEARER = 10
const CAPTURES_PER_DAY_GLOBAL = 500 // hard ceiling on paid STT + LLM spend
const REGISTRATIONS_PER_MINUTE = 30
const SSE_PING_MS = 25_000
const SSE_TICKET_TTL_MS = 60_000
const SSE_MAX_STREAMS_PER_DEVICE = 2
const SSE_MAX_QUEUE = 50

type HttpStatus = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 502 | 503 | 504

/** Fixed-window limiter; stale windows are pruned on each call so the map can't grow without bound. */
function createLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { start: number; count: number }>()
  return (key: string, now = Date.now()): boolean => {
    for (const [k, w] of windows) if (now - w.start > windowMs) windows.delete(k)
    const w = windows.get(key) ?? { start: now, count: 0 }
    w.count += 1
    windows.set(key, w)
    return w.count <= limit
  }
}

function bearer(c: Context): string | undefined {
  const h = c.req.header('Authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined
}

export function createApp(service: AgreementService, hub: Hub): Hono {
  const app = new Hono()
  const deviceLimit = createLimiter(CAPTURES_PER_MINUTE_DEVICE, 60_000)
  const wearerLimit = createLimiter(CAPTURES_PER_MINUTE_WEARER, 60_000)
  const globalDaily = createLimiter(CAPTURES_PER_DAY_GLOBAL, 24 * 60 * 60_000)
  const registerLimit = createLimiter(REGISTRATIONS_PER_MINUTE, 60_000)
  const tickets = new Map<string, { deviceId: string; expires: number }>()
  const streams = new Map<string, number>()

  // The Even WebView origin is not fixed, so CORS is open; no cookies are used and every data route needs a bearer token.
  app.use('/api/*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }))

  app.onError((err, c) => {
    if (err instanceof ServiceError) return c.json({ refusal: err.code, message: err.message }, err.status as HttpStatus)
    if (err instanceof InvalidTransitionError) return c.json({ refusal: err.code, message: 'That action no longer applies. The card was already updated.' }, 409)
    console.error('[dextra] unhandled', err instanceof Error ? err.name : 'unknown')
    return c.json({ refusal: 'SERVER_ERROR', message: 'Something went wrong on the server.' }, 500)
  })

  app.get('/health', c => c.json({ ok: true }))

  app.post('/api/devices', async c => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
    if (!registerLimit(ip)) throw new ServiceError('RATE_LIMITED', 'Too many registrations. Try again in a minute.', 429)
    return c.json(await service.registerDevice())
  })
  app.post('/api/devices/me/pair-code', async c => c.json(await service.issuePairCode(await service.authenticate(bearer(c)))))
  app.get('/api/devices/me/state', async c => c.json(await service.deviceState(await service.authenticate(bearer(c)))))

  /** Single-use, 60 s ticket so the long-lived device token never appears in a URL. */
  app.post('/api/devices/me/sse-ticket', async c => {
    const deviceId = await service.authenticate(bearer(c))
    const now = Date.now()
    for (const [t, v] of tickets) if (v.expires < now) tickets.delete(t)
    const ticket = newToken()
    tickets.set(ticket, { deviceId, expires: now + SSE_TICKET_TTL_MS })
    return c.json({ ticket })
  })

  app.get('/api/devices/me/events', c => {
    const ticket = tickets.get(c.req.query('ticket') ?? '')
    tickets.delete(c.req.query('ticket') ?? '')
    if (!ticket || ticket.expires < Date.now()) throw new ServiceError('UNAUTHORIZED', 'Event ticket expired.', 401)
    const deviceId = ticket.deviceId
    if ((streams.get(deviceId) ?? 0) >= SSE_MAX_STREAMS_PER_DEVICE) throw new ServiceError('RATE_LIMITED', 'Too many open event streams.', 429)
    return streamSSE(c, async stream => {
      streams.set(deviceId, (streams.get(deviceId) ?? 0) + 1)
      const queue: ServerEvent[] = []
      let wake: (() => void) | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      const off = hub.subscribe(deviceId, e => {
        if (queue.length >= SSE_MAX_QUEUE) queue.shift()
        queue.push(e)
        wake?.()
      })
      stream.onAbort(() => {
        off()
        if (timer) clearTimeout(timer)
        wake?.()
      })
      try {
        while (!stream.aborted) {
          const e = queue.shift()
          if (e) {
            await stream.writeSSE({ data: JSON.stringify(e) })
            continue
          }
          await new Promise<void>(r => {
            wake = r
            timer = setTimeout(r, SSE_PING_MS)
          })
          if (timer) clearTimeout(timer)
          if (!stream.aborted && queue.length === 0) await stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) })
        }
      } finally {
        off()
        streams.set(deviceId, Math.max(0, (streams.get(deviceId) ?? 1) - 1))
      }
    })
  })

  app.post(
    '/api/captures',
    bodyLimit({ maxSize: MAX_AUDIO_BYTES, onError: () => { throw new ServiceError('BAD_AUDIO', 'Audio size is out of range.', 413) } }),
    async c => {
      const deviceId = await service.authenticate(bearer(c))
      const wearer = await service.wearerOf(deviceId) // refuse unpaired devices before reading the body
      if (!deviceLimit(deviceId) || !wearerLimit(String(wearer))) throw new ServiceError('RATE_LIMITED', 'Too many locks in a minute. Wait a moment.', 429)
      if (!globalDaily('all')) throw new ServiceError('RATE_LIMITED', 'Dextra is at its daily limit. Try again later.', 429)
      const buf = new Uint8Array(await c.req.arrayBuffer())
      if (buf.byteLength === 0) throw new ServiceError('BAD_AUDIO', 'Audio size is out of range.', 413)
      return c.json(await service.captureAudio(deviceId, buf))
    },
  )

  app.get('/api/agreements', async c => c.json(await service.list(await service.authenticate(bearer(c)))))

  app.post('/api/agreements/:id/:action', async c => {
    const deviceId = await service.authenticate(bearer(c))
    const id = c.req.param('id')
    switch (c.req.param('action')) {
      case 'send':
        return c.json(await service.send(deviceId, id, c.req.query('contact')))
      case 'discard':
        return c.json(await service.discard(deviceId, id))
      case 'accept':
        return c.json(await service.accept(deviceId, id))
      case 'reject':
        return c.json(await service.reject(deviceId, id))
      case 'swap':
        return c.json(await service.swap(deviceId, id))
      case 'next-contact':
        return c.json(await service.nextContact(deviceId, id))
      default:
        throw new ServiceError('NOT_FOUND', 'Unknown action.', 404)
    }
  })

  return app
}
