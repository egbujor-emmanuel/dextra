import { AudioInputSource, waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AgreementView, Contact, DeviceState, ServerEvent } from '@dextra/core'
import { Api, ApiError } from './api'
import { PcmRing, SAMPLE_RATE, toWav } from './audio'
import { Display, MENU } from './display'
import { createGestureReader, type Gesture } from './input'
import { frameFor, type Screen } from './screens'
import { Store } from './store'
import { renderCompanion } from './companion'

/** Below this much buffered audio there is nothing worth locking. */
const MIN_LOCK_SECONDS = 2
const IDLE_REFRESH_MS = 5000
const STATE_REFRESH_MS = 30_000
const PAIR_POLL_MS = 4000
const RECONNECT_MS = 3000
const BOOT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000]

/** Lifecycle markers only (read by the simulator e2e). Never logs audio, transcripts or tokens. */
const mark = (m: string) => console.info(`[dextra] ${m}`)

interface Ctx {
  bridge: EvenAppBridge
  display: Display
  store: Store
  api: Api
  ring: PcmRing
  screen: Screen
  state: DeviceState
  listening: boolean
  agreement?: AgreementView
  contacts: Contact[]
  /** True while a server call is in flight; gestures are ignored so a second tap can't double-send. */
  busy: boolean
}

const OFFLINE_MESSAGE = "Can't reach the Dextra server. Check the phone's connection."

function show(ctx: Ctx, screen: Screen): Promise<void> {
  ctx.screen = screen
  renderCompanion(screen)
  return ctx.display.show(frameFor(screen))
}

function idle(ctx: Ctx): Promise<void> {
  return show(ctx, { kind: 'idle', state: ctx.state, listening: ctx.listening, seconds: Math.round(ctx.ring.length / SAMPLE_RATE) })
}

function refusal(ctx: Ctx, code: string, message: string, back?: Screen): Promise<void> {
  return show(ctx, { kind: 'refusal', code, message, back })
}

/** Screens a refusal should return to (so "tap again" is possible), instead of dropping the card. */
function returnable(s: Screen): Screen | undefined {
  return s.kind === 'review' || s.kind === 'sent' || s.kind === 'amended' ? s : undefined
}

async function guarded(ctx: Ctx, fn: () => Promise<void>): Promise<void> {
  const back = returnable(ctx.screen)
  ctx.busy = true
  try {
    await fn()
  } catch (e) {
    if (e instanceof ApiError) return refusal(ctx, e.refusal, e.message, back)
    if (e instanceof TypeError) return refusal(ctx, 'OFFLINE', OFFLINE_MESSAGE, back)
    return refusal(ctx, 'APP_ERROR', 'Something unexpected happened. Try again.', back)
  } finally {
    ctx.busy = false
  }
}

async function lock(ctx: Ctx): Promise<void> {
  const samples = ctx.ring.snapshot()
  if (samples.length < MIN_LOCK_SECONDS * SAMPLE_RATE) return refusal(ctx, 'TOO_SHORT', 'Not enough conversation heard yet. Keep talking, then hold again.')
  await show(ctx, { kind: 'locking' })
  mark('lock')
  await guarded(ctx, async () => {
    const res = await ctx.api.capture(toWav(samples))
    if ('refusal' in res) return refusal(ctx, res.refusal, res.message)
    ctx.ring.clear() // the same audio can't be locked twice
    ctx.agreement = res.agreement
    ctx.contacts = res.contacts
    await show(ctx, { kind: 'review', agreement: res.agreement, contact: res.agreement.contact })
  })
}

async function act(ctx: Ctx, action: Parameters<Api['act']>[1]): Promise<void> {
  const a = ctx.agreement
  if (!a) return idle(ctx)
  const contactId = action === 'send' && ctx.screen.kind === 'review' ? ctx.screen.contact?.id : undefined
  await guarded(ctx, async () => {
    const updated = await ctx.api.act(a.id, action, contactId)
    ctx.agreement = updated
    await showAgreement(ctx, updated)
  })
}

function showAgreement(ctx: Ctx, a: AgreementView): Promise<void> {
  switch (a.status) {
    case 'draft':
      return show(ctx, { kind: 'review', agreement: a, contact: a.contact })
    case 'sent':
      return show(ctx, { kind: 'sent', agreement: a })
    case 'amended':
      return show(ctx, { kind: 'amended', agreement: a })
    case 'confirmed':
    case 'fulfilled':
      return show(ctx, { kind: 'confirmed', agreement: a })
    default:
      return idle(ctx)
  }
}

async function openRecords(ctx: Ctx): Promise<void> {
  await guarded(ctx, async () => show(ctx, { kind: 'records', items: await ctx.api.list() }))
}

async function setListening(ctx: Ctx, on: boolean): Promise<void> {
  const ok = await ctx.bridge.audioControl(on, AudioInputSource.Glasses)
  ctx.listening = on && ok
  ctx.store.set('listening', on ? '1' : '0')
  if (!ctx.listening) ctx.ring.clear()
}

function onGesture(ctx: Ctx, g: Gesture): Promise<void> | void {
  if (g.kind === 'foreground') {
    // The WebView may have been suspended: re-arm the mic and repaint what the user expects to see.
    if (g.entered && ctx.listening) return setListening(ctx, true).then(() => show(ctx, ctx.screen))
    return
  }
  if (ctx.busy || ctx.screen.kind === 'locking') return
  if (g.kind === 'menu') {
    if (g.itemId === MENU.lock && ctx.state.paired) return lock(ctx)
    if (g.itemId === MENU.records && ctx.state.paired) return openRecords(ctx)
    if (g.itemId === MENU.pause) return setListening(ctx, !ctx.listening).then(() => idle(ctx))
    return
  }
  const s = ctx.screen
  if (s.kind === 'idle' || s.kind === 'pairing' || s.kind === 'boot') {
    if (g.kind === 'double') return void ctx.bridge.shutDownPageContainer(1) // root page: system exit dialog (Even QA)
    if (s.kind === 'idle' && (g.kind === 'hold' || g.kind === 'tap')) return lock(ctx)
    if (s.kind === 'idle' && (g.kind === 'up' || g.kind === 'down')) return openRecords(ctx)
    return
  }
  if (s.kind === 'review') {
    if (g.kind === 'tap') return act(ctx, 'send')
    if (g.kind === 'up') return act(ctx, 'swap')
    if (g.kind === 'down') return act(ctx, 'next-contact')
    if (g.kind === 'double') return act(ctx, 'discard')
    return
  }
  if (s.kind === 'amended') {
    if (g.kind === 'tap') return act(ctx, 'accept')
    if (g.kind === 'double') return act(ctx, 'reject')
    return
  }
  if (s.kind === 'refusal' && (g.kind === 'tap' || g.kind === 'double')) return s.back ? show(ctx, s.back) : idle(ctx)
  if (g.kind === 'tap' || g.kind === 'double') return idle(ctx)
}

function onServerEvent(ctx: Ctx, e: ServerEvent): Promise<void> | void {
  if (e.type === 'paired') return refreshState(ctx)
  if (e.type !== 'agreement') return
  // An amendment needs the wearer's decision even if they moved on to another screen.
  if (e.agreement.status === 'amended' && ctx.screen.kind !== 'review') {
    ctx.agreement = e.agreement
    return show(ctx, { kind: 'amended', agreement: e.agreement })
  }
  if (ctx.agreement?.id === e.agreement.id) {
    ctx.agreement = e.agreement
    if (ctx.screen.kind === 'sent' || ctx.screen.kind === 'amended' || ctx.screen.kind === 'review') return showAgreement(ctx, e.agreement)
  }
  return refreshState(ctx)
}

async function refreshState(ctx: Ctx): Promise<void> {
  ctx.state = await ctx.api.state()
}

function connectEvents(ctx: Ctx): void {
  const reconnect = () => setTimeout(() => {
    void refreshState(ctx).catch(() => undefined)
    connectEvents(ctx)
  }, RECONNECT_MS)
  ctx.api.events(e => void Promise.resolve(onServerEvent(ctx, e)).catch(() => undefined), reconnect).catch(reconnect)
}

async function ensureDevice(ctx: Ctx): Promise<void> {
  let token = ctx.store.get('deviceToken')
  if (!token) {
    const reg = await ctx.api.register()
    ctx.store.set('deviceId', reg.deviceId)
    ctx.store.set('deviceToken', reg.deviceToken)
    token = reg.deviceToken
  }
  ctx.api.setToken(token)
}

/** Shows a pairing code and re-issues it when it expires, until the wearer links Telegram. */
async function waitForPairing(ctx: Ctx): Promise<void> {
  let expires = 0
  while (!ctx.state.paired) {
    if (Date.now() >= expires) {
      const issued = await ctx.api.pairCode()
      expires = Date.parse(issued.expiresAt)
      await show(ctx, { kind: 'pairing', code: issued.code, botUsername: issued.botUsername })
    }
    await new Promise(r => setTimeout(r, PAIR_POLL_MS))
    await refreshState(ctx).catch(() => undefined)
  }
}

/** Retries the first server contact with backoff (e.g. a host cold start) instead of dying on one failure. */
async function connectWithRetry(ctx: Ctx): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await ensureDevice(ctx)
      await refreshState(ctx)
      return
    } catch (e) {
      const message = e instanceof ApiError ? e.message : `${OFFLINE_MESSAGE} Retrying…`
      await refusal(ctx, e instanceof ApiError ? e.refusal : 'OFFLINE', message).catch(() => undefined)
      await new Promise(r => setTimeout(r, BOOT_BACKOFF_MS[Math.min(attempt, BOOT_BACKOFF_MS.length - 1)]))
    }
  }
}

async function boot(): Promise<void> {
  const bridge = await waitForEvenAppBridge()
  const display = new Display(bridge)
  await display.init(frameFor({ kind: 'boot' }))
  const store = new Store(bridge)
  await store.load()
  const ctx: Ctx = {
    bridge, display, store, api: new Api(), ring: new PcmRing(), screen: { kind: 'boot' },
    state: { paired: false, businessConnected: false, open: 0, dueSoon: 0 },
    listening: false, contacts: [], busy: false,
  }
  const read = createGestureReader()
  bridge.onEvenHubEvent(e => {
    if (e.audioEvent) {
      if (ctx.listening) ctx.ring.pushBytes(e.audioEvent.audioPcm)
      return
    }
    const g = read(e)
    if (g) void Promise.resolve(onGesture(ctx, g)).catch(() => refusal(ctx, 'APP_ERROR', 'Something unexpected happened. Try again.').catch(() => undefined))
  })
  mark('ready')
  // Not wrapped in guarded(): boot includes the long pairing wait, and the root double-tap
  // (system exit dialog, Even QA) must keep working on the pairing screen.
  await connectWithRetry(ctx)
  connectEvents(ctx)
  await waitForPairing(ctx)
  await setListening(ctx, store.get('listening') !== '0')
  await idle(ctx)
  setInterval(() => { if (ctx.screen.kind === 'idle') void idle(ctx).catch(() => undefined) }, IDLE_REFRESH_MS)
  setInterval(() => void refreshState(ctx).catch(() => undefined), STATE_REFRESH_MS)
}

void boot()
