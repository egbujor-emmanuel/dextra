// Creates (or updates) the free Render web service "dextra" from the private GitHub repo and sets its secrets from
// apps/server/.env. Needs RENDER_API_KEY (Render ▸ Account Settings ▸ API Keys) in that .env, and the Render GitHub app
// allowed to read the repo. Usage: node scripts/deploy/render-deploy.mjs
import { randomBytes } from 'node:crypto'
import { api, readEnv, requireKeys } from './dotenv.mjs'

const BASE = 'https://api.render.com'
const NAME = 'dextra'
const REPO = 'https://github.com/egbujor-emmanuel/dextra'
const BRANCH = 'master'
const NODE_VERSION = '24.18.0'

const env = readEnv()
requireKeys(env, ['RENDER_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'DEEPGRAM_API_KEY', 'GROQ_API_KEY', 'DATABASE_URL', 'DATABASE_AUTH_TOKEN'])
if (env.DATABASE_URL.startsWith('file:')) {
  console.error('DATABASE_URL points at a local file; run scripts/deploy/turso-setup.mjs first (Render wipes local files).')
  process.exit(1)
}
const call = (method, path, body) => api(BASE, env.RENDER_API_KEY, method, path, body)

function fail(step, r) {
  console.error(`Render ${step} failed (${r.status}): ${r.json.message ?? JSON.stringify(r.json).slice(0, 400)}`)
  process.exit(1)
}

// Telegram only accepts A-Z a-z 0-9 _ - in a webhook secret; hex satisfies that.
const secrets = {
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_USERNAME: env.TELEGRAM_BOT_USERNAME,
  TELEGRAM_ENV: 'prod',
  TELEGRAM_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
  DEEPGRAM_API_KEY: env.DEEPGRAM_API_KEY,
  GROQ_API_KEY: env.GROQ_API_KEY,
  GROQ_MODEL: env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
  DATABASE_URL: env.DATABASE_URL,
  DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN,
  NODE_VERSION,
}
const envVars = Object.entries(secrets).map(([key, value]) => ({ key, value }))

const owners = await call('GET', '/v1/owners?limit=20')
if (!owners.ok) fail('list workspaces', owners)
const owner = owners.json[0]?.owner
if (!owner?.id) fail('find workspace', owners)
console.info(`workspace: ${owner.name ?? owner.id}`)

const existing = await call('GET', `/v1/services?name=${NAME}&ownerId=${owner.id}&limit=20`)
if (!existing.ok) fail('list services', existing)
let service = existing.json.find(s => s.service?.name === NAME)?.service

if (!service) {
  const created = await call('POST', '/v1/services', {
    type: 'web_service',
    name: NAME,
    ownerId: owner.id,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: 'yes',
    envVars,
    serviceDetails: {
      runtime: 'node',
      plan: 'free',
      region: 'frankfurt',
      healthCheckPath: '/health',
      envSpecificDetails: { buildCommand: 'npm ci --include=dev', startCommand: 'npm start -w @dextra/server' },
    },
  })
  if (!created.ok) fail('create service', created)
  service = created.json.service ?? created.json
  console.info(`service created: ${service.id}`)
} else {
  const put = await call('PUT', `/v1/services/${service.id}/env-vars`, envVars)
  if (!put.ok) fail('update env vars', put)
  const deploy = await call('POST', `/v1/services/${service.id}/deploys`, { clearCache: 'do_not_clear' })
  if (!deploy.ok) fail('trigger deploy', deploy)
  console.info(`service updated and redeploying: ${service.id}`)
}

console.info(`secrets set: ${Object.keys(secrets).join(', ')} (values not shown)`)
console.info(`url: ${service.serviceDetails?.url ?? `https://${NAME}.onrender.com`}`)
console.info(`dashboard: https://dashboard.render.com/web/${service.id}`)
