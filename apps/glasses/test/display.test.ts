import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { describe, expect, it } from 'vitest'
import { Display } from '../src/display'

/** Records which lens slots get rewritten. */
function fakeBridge() {
  const writes: string[] = []
  const bridge = {
    createStartUpPageContainer: async () => 0,
    textContainerUpgrade: async (u: { containerName?: string }) => {
      writes.push(u.containerName ?? '?')
      return true
    },
  } as unknown as EvenAppBridge
  return { bridge, writes }
}

describe('Display', () => {
  it('rewrites every slot once after start-up, even if the host kept an old page (app reload)', async () => {
    const { bridge, writes } = fakeBridge()
    const display = new Display(bridge)
    const home = { header: 'DEXTRA', body: 'Agreed something? Hold to lock it.', footer: '0 open' }
    await display.init(home)
    await display.show(home)
    expect(writes).toEqual(['header', 'body', 'footer'])
  })

  it('skips slots that are already showing the same text', async () => {
    const { bridge, writes } = fakeBridge()
    const display = new Display(bridge)
    const frame = { header: 'DEXTRA', body: 'a', footer: 'b' }
    await display.init(frame)
    await display.show(frame)
    writes.length = 0
    await display.show({ ...frame, footer: 'c' })
    expect(writes).toEqual(['footer'])
  })
})
