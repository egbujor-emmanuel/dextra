// Creates (or updates) the free Render static site "dextra-site" for the landing page (apps/site). Static sites on
// Render's free plan are served from a CDN and never sleep. Needs RENDER_API_KEY in apps/server/.env.
// Usage: node scripts/deploy/render-site.mjs
import { api, readEnv, requireKeys } from './dotenv.mjs'

const BASE = 'https://api.render.com'
const NAME = 'dextra-site'
const REPO = 'https://github.com/egbujor-emmanuel/dextra'
const BRANCH = 'master'
const API_ORIGIN = 'https://dextra-qfz7.onrender.com'

const env = readEnv()
requireKeys(env, ['RENDER_API_KEY'])
const call = (method, path, body) => api(BASE, env.RENDER_API_KEY, method, path, body)
function fail(step, r) {
  console.error(`Render ${step} failed (${r.status}): ${r.json.message ?? JSON.stringify(r.json).slice(0, 400)}`)
  process.exit(1)
}

// Content-Security-Policy: only our own scripts, Google Fonts, the live API for the status light; no framing.
const HEADERS = [
  { path: '/*', name: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ${API_ORIGIN}; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'` },
  { path: '/*', name: 'X-Content-Type-Options', value: 'nosniff' },
  { path: '/*', name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { path: '/*', name: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { path: '/*', name: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const WORKSPACE = env.RENDER_WORKSPACE ?? 'Dextra'
const owners = await call('GET', '/v1/owners?limit=50')
if (!owners.ok) fail('list workspaces', owners)
const owner = owners.json.map(o => o.owner).find(o => o?.name === WORKSPACE)
if (!owner) fail(`find workspace "${WORKSPACE}"`, owners)

const existing = await call('GET', `/v1/services?name=${NAME}&ownerId=${owner.id}&limit=20`)
if (!existing.ok) fail('list services', existing)
let service = existing.json.find(s => s.service?.name === NAME)?.service

if (!service) {
  const created = await call('POST', '/v1/services', {
    type: 'static_site',
    name: NAME,
    ownerId: owner.id,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: 'yes',
    serviceDetails: {
      buildCommand: 'npm ci --include=dev && npm run build -w @dextra/site',
      publishPath: 'apps/site/dist',
      pullRequestPreviewsEnabled: 'no',
    },
  })
  if (!created.ok) fail('create static site', created)
  service = created.json.service ?? created.json
  console.info(`static site created: ${service.id}`)
} else {
  console.info(`static site exists: ${service.id}`)
}

const current = await call('GET', `/v1/services/${service.id}/headers?limit=50`)
const have = new Set((current.ok ? current.json : []).map(h => `${(h.header ?? h).path}|${(h.header ?? h).name}`))
for (const h of HEADERS) {
  if (have.has(`${h.path}|${h.name}`)) continue
  const r = await call('POST', `/v1/services/${service.id}/headers`, h)
  if (!r.ok) fail(`add header ${h.name}`, r)
}
console.info(`headers set: ${HEADERS.map(h => h.name).join(', ')}`)
console.info(`url: ${service.serviceDetails?.url ?? '(shown in the dashboard once built)'}`)
console.info(`dashboard: https://dashboard.render.com/static/${service.id}`)
