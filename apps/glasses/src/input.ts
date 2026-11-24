import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

export type Gesture =
  | { kind: 'tap' }
  | { kind: 'double' }
  | { kind: 'up' }
  | { kind: 'down' }
  | { kind: 'hold' }
  | { kind: 'release' }
  | { kind: 'menu'; itemId: number }
  | { kind: 'foreground'; entered: boolean }

/** Swipes fire in bursts; ignore repeats inside this window. */
const SWIPE_COOLDOWN_MS = 300

type Envelope = { eventType?: OsEventTypeList; imuData?: unknown } | undefined

/**
 * Pick the event type across envelopes. An envelope with an explicit eventType wins; CLICK (0, decoded as undefined)
 * is only assumed when no envelope carries a type. IMU-only envelopes never count as a tap.
 */
function typeOf(envelopes: Envelope[]): OsEventTypeList | null {
  const present = envelopes.filter((e): e is NonNullable<Envelope> => Boolean(e) && !e?.imuData)
  const explicit = present.find(e => e.eventType !== undefined)
  if (explicit) return explicit.eventType ?? null
  return present.length > 0 ? OsEventTypeList.CLICK_EVENT : null
}

/**
 * Normalise SDK events into gestures. The simulator sends taps on sysEvent while hardware
 * uses textEvent/listEvent, so all three envelopes are read (CLAUDE.md, live-verified facts).
 */
export function createGestureReader(now: () => number = () => Date.now()) {
  let lastSwipe = 0
  return (event: EvenHubEvent): Gesture | null => {
    if (event.menuItemClickEvent?.itemID !== undefined) return { kind: 'menu', itemId: event.menuItemClickEvent.itemID }
    if (event.audioEvent) return null
    const t = typeOf([event.sysEvent as Envelope, event.textEvent as Envelope, event.listEvent as Envelope])
    switch (t) {
      case OsEventTypeList.LONG_PRESS_EVENT:
        return { kind: 'hold' }
      case OsEventTypeList.LONG_PRESS_RELEASE_EVENT:
        return { kind: 'release' }
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        return { kind: 'double' }
      case OsEventTypeList.CLICK_EVENT:
        return { kind: 'tap' }
      case OsEventTypeList.SCROLL_TOP_EVENT:
      case OsEventTypeList.SCROLL_BOTTOM_EVENT: {
        if (now() - lastSwipe < SWIPE_COOLDOWN_MS) return null
        lastSwipe = now()
        return { kind: t === OsEventTypeList.SCROLL_TOP_EVENT ? 'up' : 'down' }
      }
      case OsEventTypeList.FOREGROUND_ENTER_EVENT:
        return { kind: 'foreground', entered: true }
      case OsEventTypeList.FOREGROUND_EXIT_EVENT:
        return { kind: 'foreground', entered: false }
      default:
        return null
    }
  }
}
