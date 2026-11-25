// Prints the live reminders table (kind and time only, no names or chat ids) to confirm the scheduler fired.
// Usage: node scripts/check-reminders.mjs
import { createClient } from '@libsql/client'
import { readEnv, requireKeys } from './deploy/dotenv.mjs'

const env = readEnv()
requireKeys(env, ['DATABASE_URL', 'DATABASE_AUTH_TOKEN'])
const db = createClient({ url: env.DATABASE_URL.replace(/^libsql:\/\//, 'https://'), authToken: env.DATABASE_AUTH_TOKEN })
const { rows } = await db.execute('SELECT * FROM reminders')
console.log(`${rows.length} reminder(s) sent`)
for (const r of rows) console.log(Object.fromEntries(Object.entries(r).filter(([k]) => !/chat|tg|name|user/i.test(k))))
