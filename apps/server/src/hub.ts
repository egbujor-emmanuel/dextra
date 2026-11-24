import type { ServerEvent } from '@dextra/core'

type Listener = (e: ServerEvent) => void

/** In-process fan-out of server events to each device's open SSE streams. */
export class Hub {
  private readonly listeners = new Map<string, Set<Listener>>()

  subscribe(deviceId: string, fn: Listener): () => void {
    const set = this.listeners.get(deviceId) ?? new Set<Listener>()
    set.add(fn)
    this.listeners.set(deviceId, set)
    return () => {
      set.delete(fn)
      if (set.size === 0) this.listeners.delete(deviceId)
    }
  }

  /** A throwing listener must never abort the fan-out or fail the request that published. */
  publish(deviceId: string, e: ServerEvent): void {
    for (const fn of this.listeners.get(deviceId) ?? []) {
      try {
        fn(e)
      } catch {
        // listener errors are isolated by design
      }
    }
  }
}
