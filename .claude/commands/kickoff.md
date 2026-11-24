Bring a fresh clone of DEXTRA to a working state.

1. `npm install` at the repo root.
2. Copy `.env.example` to `apps/server/.env`, then fill in TELEGRAM_BOT_TOKEN, DEEPGRAM_API_KEY, and ANTHROPIC_API_KEY or OPENROUTER_API_KEY. Do not print the values.
3. `npm run typecheck && npm test`. Both must pass before continuing.
4. Start the server, then the glasses app, then the simulator:
   - `npm run dev:server`
   - `npm run dev:glasses`
   - `npm run sim`
5. Run `npm run e2e`. Report every assertion it printed.
6. Read PRD.md §11 and report the status of each kill gate.
