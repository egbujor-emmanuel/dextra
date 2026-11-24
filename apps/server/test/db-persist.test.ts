import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { Db } from '../src/db'

describe('Db persistence (what Turso gives us on Render)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dextra-db-'))
  const url = `file:${join(dir, 'dextra.db').split(sep).join('/')}`
  // Windows keeps the native file handle for a moment after close(); retry, and leave a temp folder rather than fail a passing test.
  afterAll(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    } catch {
      console.warn(`[test] could not remove temp folder ${dir} (Windows file lock); safe to delete`)
    }
  })

  it('keeps pairings and agreements across a restart', async () => {
    const first = await Db.open(url)
    await first.insertDevice('dev_1', 'hash_1', '2026-11-24T10:00:00.000Z')
    await first.bindDevice('dev_1', 100)
    await first.upsertWearer(100, 'Yoma', '2026-11-24T10:00:00.000Z')
    first.close()

    const second = await Db.open(url) // a restart re-runs the schema; it must not wipe anything
    expect(await second.deviceByTokenHash('hash_1')).toEqual({ id: 'dev_1', wearer_tg_id: 100 })
    expect((await second.wearer(100))?.name).toBe('Yoma')
    second.close()
  })

  it('pair codes are single-use even under concurrent redemption', async () => {
    const db = await Db.open(url)
    await db.savePairCode('ABCD2345', 'dev_1', '2026-11-24T10:10:00.000Z')
    const results = await Promise.all([db.takePairCode('ABCD2345', '2026-11-24T10:00:00.000Z'), db.takePairCode('ABCD2345', '2026-11-24T10:00:00.000Z')])
    expect(results.filter(Boolean)).toEqual(['dev_1'])
    db.close()
  })
})
