import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

const KEYS = ['deviceId', 'deviceToken', 'listening'] as const
export type StoreKey = (typeof KEYS)[number]

/**
 * Bridge-backed storage with a sync cache. Browser localStorage does not survive in a packed
 * .ehpk (field-tested, even-g2-notes), so the bridge is the source of truth. Empty string = absent.
 */
export class Store {
  private readonly cache = new Map<StoreKey, string>()

  constructor(private readonly bridge: EvenAppBridge) {}

  async load(): Promise<void> {
    await Promise.all(
      KEYS.map(async k => {
        const v = await this.bridge.getLocalStorage(k)
        if (v) this.cache.set(k, v)
      }),
    )
  }

  get(key: StoreKey): string | undefined {
    return this.cache.get(key)
  }

  set(key: StoreKey, value: string): void {
    this.cache.set(key, value)
    void this.bridge.setLocalStorage(key, value)
  }
}
