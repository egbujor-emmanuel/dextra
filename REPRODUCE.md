# Reproduce DEXTRA from a clean clone

Needs Node 22.5+ and git. Steps 1, 2, 4, 5 and 6 were run on Windows 10 (Git Bash and PowerShell) on 2026-11-24.

## 1. Build and test (no keys)

```bash
git clone https://github.com/egbujor-emmanuel/dextra && cd dextra
npm ci
npm run typecheck   # clean
npm test            # 112 passing: core 50, glasses 15, server 47
```

## 2. Try it against the live server (no keys)

```bash
npm run try         # glasses app → https://dextra-qfz7.onrender.com, plus the Even simulator
npm run e2e         # second terminal: 5/5 checks through the simulator automation API
```

Then follow the 7 steps in [README.md](README.md#judges-start-here-no-g2-and-no-api-keys-needed) with two Telegram accounts.

## 3. Run everything yourself (your own keys)

```bash
cp .env.example apps/server/.env    # TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, DEEPGRAM_API_KEY, GROQ_API_KEY
npm run dev:server                  # http://localhost:8787, local SQLite file
npm run dev:glasses
npm run sim
```

In @BotFather, turn on **Secretary Mode** for your bot. For data that survives restarts, add `DATABASE_URL` / `DATABASE_AUTH_TOKEN` from a free [Turso](https://turso.tech) database.

## 4. Deploy (free)

```bash
node scripts/deploy/turso-setup.mjs     # needs TURSO_API_TOKEN in apps/server/.env
node scripts/deploy/render-deploy.mjs   # needs RENDER_API_KEY and a Render workspace named "Dextra"
node scripts/deploy/render-site.mjs     # the landing page as a free static site (never sleeps)
node scripts/deploy/cronjob-setup.mjs   # needs CRONJOB_API_KEY: wakes the server every 15 min for reminders
```

Both scripts read keys from `apps/server/.env` and print only names, IDs and hostnames.

## 5. Package the glasses app

```bash
npm run pack -w @dextra/glasses     # apps/glasses/dextra.ehpk (about 68 KB), pointed at the live server, no secrets
```

## 6. Extraction eval (free Groq tier)

```bash
npm run eval -w @dextra/server      # writes evidence/eval-commitments.json
```

Groq answers `403 Access denied` from some VPN and data-centre networks; run it from a normal connection.
