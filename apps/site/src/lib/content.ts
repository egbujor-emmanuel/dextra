import evalResult from '../../../../evidence/eval-commitments.json'

export const BOT_URL = 'https://t.me/DextraAgreeBot'
export const BOT_HANDLE = '@DextraAgreeBot'
export const API_URL = 'https://dextra-qfz7.onrender.com'
export const REPO_URL = 'https://github.com/egbujor-emmanuel/dextra'

/** Real captures from the official Even simulator running DEXTRA against the live server (2026-11-24). */
export const FRAMES = [
  { src: '/lens/02-listen.png', label: 'Listening' },
  { src: '/lens/03-card.png', label: 'Agreement card' },
  { src: '/lens/04-sent.png', label: 'Sent, waiting for them' },
  { src: '/lens/01-pair.png', label: 'Pairing with Telegram' },
] as const

/** Measured, read from evidence/ at build time so the page can't drift from the eval. */
export const EVAL = {
  cases: evalResult.cases,
  commitments: evalResult.tp + evalResult.fn,
  precision: evalResult.precision.toFixed(2),
  recall: evalResult.recall.toFixed(2),
  inventedPassed: evalResult.unsupportedPassed,
  model: evalResult.model,
}

/** Counted from `npm test` (core 50, glasses 15, server 47) on 2026-11-24. */
export const TESTS = 112
export const INVARIANTS = 29
