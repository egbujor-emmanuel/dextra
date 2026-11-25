// Creates (or updates) a cron-job.org job that calls the live server's housekeeping every 15 minutes, so reminders and
// expiry run even though the free Render server sleeps (GitHub's scheduled workflows proved unreliable on 2026-11-24).
// Needs CRONJOB_API_KEY and CRON_SECRET in apps/server/.env. Prints neither. Usage: node scripts/deploy/cronjob-setup.mjs
import { api, readEnv, requireKeys } from './dotenv.mjs'

const BASE = 'https://api.cron-job.org'
const TITLE = 'dextra-housekeeping'
const TARGET = 'https://dextra-qfz7.onrender.com/internal/housekeeping'
const POST = 1

const env = readEnv()
requireKeys(env, ['CRONJOB_API_KEY', 'CRON_SECRET'])
const call = (method, path, body) => api(BASE, env.CRONJOB_API_KEY, method, path, body)
function fail(step, r) {
  console.error(`cron-job.org ${step} failed (${r.status}): ${JSON.stringify(r.json).slice(0, 300)}`)
  process.exit(1)
}

const job = {
  title: TITLE,
  url: TARGET,
  enabled: true,
  saveResponses: true,
  requestMethod: POST,
  requestTimeout: 30, // a cold start can take longer; the request still wakes the server for the next run
  extendedData: { headers: { 'x-cron-secret': env.CRON_SECRET }, body: '' },
  schedule: { timezone: 'UTC', expiresAt: 0, hours: [-1], mdays: [-1], months: [-1], wdays: [-1], minutes: [2, 17, 32, 47] },
}

const list = await call('GET', '/jobs')
if (!list.ok) fail('list jobs', list)
const existing = (list.json.jobs ?? []).find(j => j.title === TITLE)

if (existing) {
  const r = await call('PATCH', `/jobs/${existing.jobId}`, { job })
  if (!r.ok) fail('update job', r)
  console.info(`job updated: ${existing.jobId}`)
} else {
  const r = await call('PUT', '/jobs', { job })
  if (!r.ok) fail('create job', r)
  console.info(`job created: ${r.json.jobId}`)
}
console.info(`schedule: every 15 min (at :02, :17, :32, :47 UTC) → POST ${TARGET} with x-cron-secret (value not shown)`)
