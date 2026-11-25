# DEXTRA

**Agree something out loud, and your glasses turn it into a note the other person confirms in Telegram.**

*Dictum, factum.* Said, done.

An Even G2 plugin plus a Telegram business bot. Built for **Heads Up** (Even Realities × TVM Ventures × Daos Hub).

Tracks: 01 Messaging & News (Telegram) and 04 AI Assistants & Work.

**Live:** bot [@DextraAgreeBot](https://t.me/DextraAgreeBot) · server [dextra-qfz7.onrender.com/health](https://dextra-qfz7.onrender.com/health)

---

## Judges, start here (no G2 and no API keys needed)

You need Node 22.5+ and **two Telegram accounts**: yours (the wearer) and a second one, or a friend (the other person).

```bash
git clone https://github.com/egbujor-emmanuel/dextra && cd dextra
npm install
npm run try
```

`npm run try` opens the official Even simulator running DEXTRA, connected to the live server, and uses your default microphone. The free server sleeps when idle, so the first call can take up to a minute.

| Step | What you do | What you see |
|---|---|---|
| 1 | Send the code on the lens to [@DextraAgreeBot](https://t.me/DextraAgreeBot): `/pair XXXXXXXX` | Bot: **Linked ✓** · lens: `● listening · Agreed something? Hold to lock it.` |
| 2 | Telegram ▸ **Settings ▸ Chat Automation** ▸ add **@DextraAgreeBot** and allow **Reply to messages** | The lens footer changes to `0 open · 0 due soon` |
| 3 | From the **second account**, send your account any message, e.g. "hi" | Nothing visible. This opens Telegram's 24 h window for business replies |
| 4 | Two people near the mic agree something with a date: *"Can you send me the deck by Friday?" / "Yes, I'll send it Friday. Can you intro me to Sara?" / "Deal."* Then press **Long Press** in the simulator | `Locking what was said…`, then the card: `Agreed with <them>?` with one line per commitment and its date |
| 5 | Press **Click** (send) | Lens: `Sent to <them> · waiting for them to confirm` |
| 6 | On the second account, open the Dextra message, tap its link, then tap **Confirm ✓** | Lens: `<them> confirmed ✓ · Dictum, factum.` Your chat gets the record with its fingerprint |
| 7 | Tap an item in the **"Tap each item when it's done"** message that both of you get from the bot | ☐ becomes ☑, the other person is told, and the lens updates. When all items are done the record is **fulfilled** |

On the lens, **Up** swaps who owes what, **Down** picks another recipient and **Double Click** drops a draft.

The day before anything is due, the person who owes it gets **⏰ Due tomorrow**. They get **Due today** on the day. If it slips, both people get **Overdue**. Each reminder carries the same tap-when-done buttons.

You can also press the simulator buttons from a script (automation port 9898):

```bash
curl -X POST localhost:9898/api/input -H "Content-Type: application/json" -d '{"action":"long_press"}'
```
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:9898/api/input -ContentType 'application/json' -Body '{"action":"long_press"}'
```

---

## Why this exists

People make spoken commitments all day, and later each side remembers them differently. Existing tools don't close the gap:

| Tool | What it does | What's missing |
|---|---|---|
| Meeting notetakers (Otter, Fireflies, Granola) | Take notes | Only in video calls, and only the note-taker's version |
| Conversate (Even's own) | Summarises the conversation | Only the wearer sees it |
| Shared-promise apps (Vowlet, StampPact) | Track promises between people | You fill them in by hand |
| OPay Shield Pay | Escrow | Holds money; doesn't record what was said |

**DEXTRA captures the spoken agreement at the moment it happens, and the *other person* confirms it in their own Telegram.** Nothing counts as agreed until they tap. After that, both people track it to done.

## How it works

```
G2 mic ─► phone WebView: 45 s ring buffer, memory only ──hold──► server (Render)
server ─► Deepgram: speech-to-text and who spoke
       ─► who said each line: Deepgram's voice separation → per-sentence voice pitch → the LLM's turn guess
       ─► the LLM (free Groq tier, gpt-oss-120b, JSON schema) proposes commitments, each with a verbatim quote
       ─► core validator keeps only commitments backed by that speaker's own words, and merges repeats
lens  ◄─ card ──tap──► Telegram business bot sends it as you, into the chat with them
their tap: Confirm ─► SHA-256 record (Turso) ─► shared checklist (wearer has Premium) or record message + tap-when-done buttons
           Change  ─► their correction comes back to your lens to accept or reject
every 15 min       ─► due tomorrow / due today / overdue reminders with the same buttons (cron-job.org wakes the free server; GitHub Actions hourly as a backup)
```

**The LLM proposes, deterministic code decides.** Every proposed commitment carries a verbatim quote. [`packages/core/src/validate.ts`](packages/core/src/validate.ts) drops any commitment whose quote isn't in what *that speaker* said (`UNSUPPORTED_BY_TRANSCRIPT`). It also drops any amount that wasn't spoken, and merges repeats (`DUPLICATE`). A test proves an invented "pay $5,000" never reaches the lens.

**Every step is a typed state transition** ([`packages/core/src/state.ts`](packages/core/src/state.ts)): draft → sent → (amended) → confirmed → fulfilled, plus discarded and expired. Only the counterparty can confirm or change a record. Only the two people in it can tick its items. A double tap sends once.

**Telegram checklists need Premium.** `sendChecklist` on a business connection returns `PREMIUM_ACCOUNT_REQUIRED` for non-Premium accounts (verified live). DEXTRA then posts the record as a message and gives both people tap-when-done buttons in their bot chat. The lens footer always says which of the two happened.

## Privacy and safety

- **Audio:** never written to disk. It is held in phone memory for 45 s, sent once when you hold to lock, then dropped.
- **Transcripts:** unconfirmed drafts are deleted after 24 h. A confirmed record keeps only the commitments and their quotes.
- **Business chats:** only metadata (who wrote, when) is kept, to know who can be messaged. Message text is never stored or sent to any AI (Telegram Bot Developer ToS 5.4).
- **Consent:** the counterparty sees exactly what they confirm, and can change it before it counts.
- **Keys:** server-side only. The glasses bundle contains no secrets. Server logs carry numbers and error codes, never words or tokens.

Threat model and the test behind each invariant: [THREAT_MODEL.md](THREAT_MODEL.md).

## Run your own server

| Variable | Used for |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | The bot (from @BotFather). Turn on **Secretary Mode** in its Bot Settings |
| `DEEPGRAM_API_KEY` | Speech-to-text with speaker separation |
| `GROQ_API_KEY` | Commitment extraction on the free Groq tier (`openai/gpt-oss-120b`). `ANTHROPIC_API_KEY` is an optional paid alternative |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Optional: a free [Turso](https://turso.tech) database. Without them, a local SQLite file is used |

```bash
cp .env.example apps/server/.env     # fill in the keys
npm run dev:server                   # http://localhost:8787
npm run dev:glasses && npm run sim   # simulator against your local server
```

Deploy: [`render.yaml`](render.yaml) (Render free plan). [`scripts/deploy/`](scripts/deploy) creates the Turso database and the Render service through their APIs, reading keys from `apps/server/.env` and never printing them. Missing keys don't crash the server; the affected feature returns a typed refusal, e.g. `STT_NOT_CONFIGURED`.

## Proof

| Check | Command | Result |
|---|---|---|
| Unit and integration tests (core, glasses, server) | `npm test` | **111 passing** |
| Typecheck | `npm run typecheck` | clean |
| Simulator end to end | `npm run e2e` | PASS per check |
| Extraction eval on the free model | `npm run eval -w @dextra/server` | 12 conversations, 17 commitments: **precision 1.00, recall 0.94**; **0** invented commitments reached the lens (last two runs, 2026-11-24, `openai/gpt-oss-120b`) |
| Live flow | pair → lock → send → confirm → tick → fulfilled | verified on the live server with two real Telegram accounts (2026-11-24) |

## What existed before Nov 23

Nothing of DEXTRA. Everything in this repo was written during the build week.

Third-party libraries used:

- `@evenrealities/even_hub_sdk`
- grammY
- Hono
- `@libsql/client`
- chrono-node
- `@noble/hashes`
- zod
- `@anthropic-ai/sdk` (optional)

## API feature requests (for the Even and Telegram teams)

1. **Even:** an OS-drawn exit dialog in the simulator, so `shutDownPageContainer(1)` can be checked without hardware.
2. **Even:** `speakerRole` and `direction` in the simulator's audio events, so speaker-aware apps can be tested.
3. **Even:** plugin access to Even AI's on-device speech-to-text.
4. **Telegram:** let business bots message a contact outside the 24 h window, with explicit user consent.
5. **Telegram:** shared checklists for business bots without requiring the account to have Premium.
