// Creates (or reuses) the free Turso database "dextra" and writes DATABASE_URL + DATABASE_AUTH_TOKEN into
// apps/server/.env. Needs TURSO_API_TOKEN (Turso dashboard ▸ Settings ▸ API Tokens) in that same .env.
// Usage: node scripts/deploy/turso-setup.mjs
import { api, readEnv, requireKeys, writeEnvKeys } from './dotenv.mjs'

const BASE = 'https://api.turso.tech'
const DB_NAME = 'dextra'
const GROUP = 'default'

const env = readEnv()
requireKeys(env, ['TURSO_API_TOKEN'])
const call = (method, path, body) => api(BASE, env.TURSO_API_TOKEN, method, path, body)

function fail(step, r) {
  console.error(`Turso ${step} failed (${r.status}): ${r.json.error ?? r.json.message ?? JSON.stringify(r.json).slice(0, 300)}`)
  process.exit(1)
}

const orgs = await call('GET', '/v1/organizations')
if (!orgs.ok) fail('list organizations', orgs)
const org = (Array.isArray(orgs.json) ? orgs.json : orgs.json.organizations ?? [])[0]
if (!org?.slug) fail('find organization', orgs)
console.info(`organization: ${org.slug}`)

const groups = await call('GET', `/v1/organizations/${org.slug}/groups`)
if (!groups.ok) fail('list groups', groups)
const groupList = groups.json.groups ?? []
let group = groupList.find(g => g.name === GROUP) ?? groupList[0]
if (!group) {
  // No group yet on a fresh account: create one in the closest European location (judging is in Dubai, user in Lagos).
  const locs = await call('GET', '/v1/locations')
  if (!locs.ok) fail('list locations', locs)
  const codes = Object.keys(locs.json.locations ?? {})
  const location = codes.find(c => /fra|eu-central|eu-west|ams|lhr/.test(c)) ?? codes[0]
  const created = await call('POST', `/v1/organizations/${org.slug}/groups`, { name: GROUP, location })
  if (!created.ok) fail('create group', created)
  group = created.json.group ?? { name: GROUP }
  console.info(`group created: ${GROUP} in ${location}`)
}

let db = await call('POST', `/v1/organizations/${org.slug}/databases`, { name: DB_NAME, group: group.name })
if (db.status === 409) db = await call('GET', `/v1/organizations/${org.slug}/databases/${DB_NAME}`)
if (!db.ok) fail('create database', db)
const hostname = db.json.database?.Hostname ?? db.json.database?.hostname
if (!hostname) fail('read database hostname', db)
console.info(`database: ${DB_NAME} at ${hostname}`)

const token = await call('POST', `/v1/organizations/${org.slug}/databases/${DB_NAME}/auth/tokens?authorization=full-access`)
if (!token.ok || !token.json.jwt) fail('create database token', token)

writeEnvKeys({ DATABASE_URL: `libsql://${hostname}`, DATABASE_AUTH_TOKEN: token.json.jwt })
console.info('wrote DATABASE_URL and DATABASE_AUTH_TOKEN to apps/server/.env (values not shown)')
