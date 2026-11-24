// Minimal .env reader/writer for the deploy scripts. Same precedence as `node --env-file`: the last occurrence wins,
// commented lines are ignored. Values are never printed by these helpers.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export const SERVER_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/server/.env')

export function readEnv(path = SERVER_ENV) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (value !== '') out[m[1]] = value
  }
  return out
}

/** Sets keys in place (replacing earlier uncommented definitions) and appends new ones. */
export function writeEnvKeys(updates, path = SERVER_ENV) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const pending = new Map(Object.entries(updates))
  const next = lines.filter(line => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]
    return !(key && pending.has(key)) // drop old definitions; fresh ones are appended below
  })
  while (next.length && next[next.length - 1] === '') next.pop()
  next.push('', '# Added by scripts/deploy (production database)')
  for (const [key, value] of pending) next.push(`${key}=${value}`)
  writeFileSync(path, next.join('\n') + '\n')
}

export function requireKeys(env, keys) {
  const missing = keys.filter(k => !env[k])
  if (missing.length) {
    console.error(`Missing in apps/server/.env: ${missing.join(', ')}`)
    process.exit(1)
  }
}

export async function api(base, token, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text.slice(0, 300) } }
  return { status: res.status, ok: res.ok, json }
}
