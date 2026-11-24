import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8787'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().default('DextraBot'),
  TELEGRAM_ENV: z.enum(['prod', 'test']).default('prod'),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(32, 'TELEGRAM_WEBHOOK_SECRET must be at least 32 characters').optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_PATH: z.string().default('./data/dextra.db'),
})

export type Env = z.infer<typeof envSchema>

/** Missing keys are allowed at boot; the features that need them return typed errors instead. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''))
  return envSchema.parse(cleaned)
}
