// Creates (or updates) a cron-job.org job that calls the live server's housekeeping every 10 minutes, so reminders and
// expiry run on the free Render server (GitHub's scheduled workflows proved unreliable on 2026-11-24).
// Every 10 minutes, not 15: Render spins a free instance down after 15 idle minutes, and a 15-minute ping let it sleep.
// On 2026-11-25, 03:02-09:17 UTC, every wake-up ping got an instant 502 and cron-job.org disabled the job. Staying warm
// costs about 744 instance-hours a month, inside the free 750.
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
  // Email the account owner if cron-job.org ever disables the job again, or after 3 failures in a row.
  notification: { onFailure: true, onFailureCount: 3, onSuccess: false, onDisable: true },
  saveResponses: true,
  requestMethod: POST,
  requestTimeout: 30, // a cold start can take longer; the request still wakes the server for the next run
  extendedData: { headers: { 'x-cron-secret': env.CRON_SECRET }, body: '' },
  schedule: { timezone: 'UTC', expiresAt: 0, hours: [-1], mdays: [-1], months: [-1], wdays: [-1], minutes: [2, 12, 22, 32, 42, 52] },
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
console.info(`schedule: every 10 min (at :02, :12, :22, :32, :42, :52 UTC) → POST ${TARGET} with x-cron-secret (value not shown)`)
