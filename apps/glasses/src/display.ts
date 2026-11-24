import {
  CreateStartUpPageContainer,
  MenuContainerProperty,
  MenuItemProperty,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type { TextFrame } from './screens'

export const MENU = { lock: 1, records: 2, pause: 3 } as const

interface Slot {
  id: number
  name: string
  key: keyof TextFrame
}

const SLOTS: Slot[] = [
  { id: 1, name: 'header', key: 'header' },
  { id: 2, name: 'body', key: 'body' },
  { id: 3, name: 'footer', key: 'footer' },
]

/**
 * Owns the lens. Host calls are serialised (the SDK forbids concurrent sends) and only
 * containers whose text changed are rewritten (each call costs ~83 ms over BLE).
 */
export class Display {
  private queue: Promise<unknown> = Promise.resolve()
  private current: TextFrame = { header: '', body: '', footer: '' }

  constructor(private readonly bridge: EvenAppBridge) {}

  async init(first: TextFrame): Promise<boolean> {
    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 3,
        textObject: [
          new TextContainerProperty({ xPosition: 8, yPosition: 4, width: 560, height: 40, containerID: 1, containerName: 'header', content: first.header || ' ', textColor: 3, isEventCapture: 0 }),
          new TextContainerProperty({ xPosition: 8, yPosition: 50, width: 560, height: 186, containerID: 2, containerName: 'body', content: first.body || ' ', textColor: 4, isEventCapture: 1 }),
          new TextContainerProperty({ xPosition: 8, yPosition: 244, width: 560, height: 40, containerID: 3, containerName: 'footer', content: first.footer || ' ', textColor: 2, isEventCapture: 0 }),
        ],
        menuObject: new MenuContainerProperty({
          menuItems: [
            new MenuItemProperty({ itemName: 'Lock now', itemID: MENU.lock }),
            new MenuItemProperty({ itemName: 'Records', itemID: MENU.records }),
            new MenuItemProperty({ itemName: 'Pause listening', itemID: MENU.pause }),
          ],
        }),
      }),
    )
    this.current = first
    return result === 0
  }

  /** Tracks what the lens shows per slot, so a partial failure can never leave a stale "already shown" cache. */
  show(frame: TextFrame): Promise<void> {
    const next = this.queue.then(async () => {
      for (const slot of SLOTS) {
        const text = frame[slot.key] || ' '
        if (text === (this.current[slot.key] || ' ')) continue
        const ok = await this.bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: slot.id, containerName: slot.name, content: text }))
        if (!ok) throw new Error(`lens update refused for ${slot.name}`)
        this.current = { ...this.current, [slot.key]: text }
      }
    })
    this.queue = next.catch(() => undefined)
    return next
  }
}
