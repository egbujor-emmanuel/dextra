import { describe, expect, it } from 'vitest'
import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { createGestureReader } from '../src/input'

const ev = (e: Record<string, unknown>) => e as unknown as EvenHubEvent

describe('gesture reader', () => {
  it('reads a tap whose CLICK type (0) was decoded as undefined', () => {
    expect(createGestureReader()(ev({ sysEvent: {} }))).toEqual({ kind: 'tap' })
  })

  it('an explicit type in any envelope beats an empty one (no false tap masking a double-tap)', () => {
    const g = createGestureReader()(ev({ sysEvent: {}, textEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT } }))
    expect(g).toEqual({ kind: 'double' })
  })

  it('IMU-only envelopes never count as a tap', () => {
    expect(createGestureReader()(ev({ sysEvent: { imuData: { x: 1, y: 2, z: 3 } } }))).toBeNull()
  })

  it('debounces swipe bursts', () => {
    let t = 1000
    const read = createGestureReader(() => t)
    expect(read(ev({ textEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT } }))).toEqual({ kind: 'down' })
    t += 100
    expect(read(ev({ textEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT } }))).toBeNull()
    t += 400
    expect(read(ev({ textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT } }))).toEqual({ kind: 'up' })
  })

  it('routes contextual-menu clicks and long-press pairs', () => {
    const read = createGestureReader()
    expect(read(ev({ menuItemClickEvent: { itemID: 2 } }))).toEqual({ kind: 'menu', itemId: 2 })
    expect(read(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_EVENT } }))).toEqual({ kind: 'hold' })
    expect(read(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_RELEASE_EVENT } }))).toEqual({ kind: 'release' })
  })
})
