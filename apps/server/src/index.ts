import { serve } from '@hono/node-server'
import { GrammyError, webhookCallback, type Bot } from 'grammy'
import { ALLOWED_UPDATES, createBot, registerHandlers, TelegramMessenger } from './bot'
import { Db } from './db'
import { loadEnv } from './env'
import { notConfigured } from './errors'
import { ClaudeExtractor, GroqExtractor } from './extract'
import { createApp } from './http'
import { Hub } from './hub'
import { AgreementService, type Messenger } from './service'
import { DeepgramTranscriber } from './stt'

const PURGE_EVERY_MS = 15 * 60_000

/** Used when no bot token is set: every Telegram action fails with a typed, honest error. */
const offlineMessenger: Messenger = {
  sendAgreementCard: () => Promise.reject(notConfigured('TELEGRAM', 'TELEGRAM_BOT_TOKEN')),
  postChecklist: () => Promise.reject(notConfigured('TELEGRAM', 'TELEGRAM_BOT_TOKEN')),
  postText: () => Promise.reject(notConfigured('TELEGRAM', 'TELEGRAM_BOT_TOKEN')),
  notify: () => Promise.resolve(),
}

const GETME_ATTEMPTS = 3

/** Telegram may answer 429 right after a bot is created; honour retry_after instead of crashing. */
async function resolveBotUsername(bot: Bot): Promise<string | undefined> {
  for (let attempt = 1; attempt <= GETME_ATTEMPTS; attempt++) {
    try {
      return (await bot.api.getMe()).username
    } catch (e) {
      const wait = e instanceof GrammyError && e.error_code === 429 ? (e.parameters.retry_after ?? 5) : 0
      if (e instanceof GrammyError && e.error_code === 401) throw new Error('TELEGRAM_BOT_TOKEN was rejected by Telegram (401). Check the token.')
      console.warn(`[dextra] getMe attempt ${attempt} failed${wait ? `; Telegram asked to wait ${wait}s` : ''}`)
      if (attempt < GETME_ATTEMPTS) await new Promise(r => setTimeout(r, (wait || 3) * 1000))
    }
  }
  console.warn('[dextra] using TELEGRAM_BOT_USERNAME from .env as the bot username')
  return undefined
}

async function main(): Promise<void> {
  const env = loadEnv()
  const db = await Db.open(env.DATABASE_URL ?? `file:${env.DATABASE_PATH}`, env.DATABASE_AUTH_TOKEN)
  const hub = new Hub()
  const bot = env.TELEGRAM_BOT_TOKEN ? createBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ENV) : undefined
  // getMe verifies the token and gives the real username (the env value is only a fallback).
  const botUsername = (bot ? await resolveBotUsername(bot) : undefined) ?? env.TELEGRAM_BOT_USERNAME
  const messenger = bot ? new TelegramMessenger(bot) : offlineMessenger
  const service = new AgreementService({
    db,
    hub,
    transcriber: new DeepgramTranscriber(env.DEEPGRAM_API_KEY),
    // Free Groq tier by default (zero budget); Claude only if a key is provided and Groq is not.
    extractor: env.GROQ_API_KEY || !env.ANTHROPIC_API_KEY ? new GroqExtractor(env.GROQ_API_KEY, env.GROQ_MODEL) : new ClaudeExtractor(env.ANTHROPIC_API_KEY),
    messenger,
    botUsername,
    log: m => console.warn(m),
  })
  const app = createApp(service, hub)

  if (bot) {
    registerHandlers(bot, service, db, messenger)
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      app.post('/telegram/webhook', webhookCallback(bot, 'hono', { secretToken: env.TELEGRAM_WEBHOOK_SECRET }))
      await bot.api.setWebhook(`${env.PUBLIC_BASE_URL}/telegram/webhook`, { secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: [...ALLOWED_UPDATES] })
    } else {
      bot.start({ allowed_updates: [...ALLOWED_UPDATES], drop_pending_updates: false }).catch(e => {
        console.error('[dextra] bot polling stopped', e instanceof Error ? e.name : 'error')
      })
    }
  }

  setInterval(() => {
    service.housekeeping().catch(e => console.error('[dextra] housekeeping failed', e instanceof Error ? e.name : 'error'))
  }, PURGE_EVERY_MS)
  serve({ fetch: app.fetch, port: env.PORT })
  const features = [`telegram:${bot ? `${env.TELEGRAM_ENV} @${botUsername}` : 'off'}`, `stt:${env.DEEPGRAM_API_KEY ? 'on' : 'off'}`, `llm:${env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'claude' : 'off'}`, `db:${env.DATABASE_URL?.startsWith('file:') || !env.DATABASE_URL ? 'local' : 'turso'}`]
  console.info(`[dextra] server on :${env.PORT} (${features.join(' ')})`)
}

main().catch(e => {
  console.error('[dextra] failed to start', e instanceof Error ? e.message : 'error')
  process.exit(1)
})
