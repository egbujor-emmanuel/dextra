# DEXTRA

**Agree something out loud, and your glasses turn it into a note the other person confirms in Telegram.**

*Dictum, factum.* Said, done.

An Even G2 plugin plus a Telegram business bot. Built for **Heads Up** (Even Realities × TVM Ventures × Daos Hub).

Tracks: 01 Messaging & News (Telegram) and 04 AI Assistants & Work.

---

## Judges, start here (no G2 needed)

| Step | What you do | What you see |
|---|---|---|
| 1 | `npm install`, then `cp .env.example apps/server/.env` and fill in the keys (see [Setup](#setup)) | — |
| 2 | Start everything: `npm run dev:server`, `npm run dev:glasses`, `npm run sim` | The simulator shows a `/pair` code on the lens |
| 3 | In Telegram, send `/pair CODE` to the bot. Then go to Settings ▸ Chat Automation and add the bot | The lens says `● listening · hold to lock` |
| 4 | Have a short two-person conversation near the laptop mic, e.g. "Deck by Friday?" / "Deal." Then send `long_press` (or click in the simulator) | The lens shows `Omar ▸ send the deck · Fri 28 Nov` |
| 5 | Tap | The other person's Telegram gets the note, with Confirm or Change |
| 6 | They tap **Confirm** | The lens shows `Omar confirmed ✓`, and a shared Telegram checklist appears in your chat |

Machine check: run `npm run e2e` while the simulator is up. It drives the simulator through its automation API and prints PASS or FAIL per check.

---

## Why this exists

People make spoken commitments all day, and later each side remembers them differently. Existing tools don't close the gap:

| Tool | What it does | What's missing |
|---|---|---|
| Meeting notetakers (Otter, Fireflies, Granola) | Take notes | Only in video calls, and only the note-taker's version |
| Conversate (Even's own) | Summarises the conversation | Only the wearer sees it |
| Shared-promise apps (Vowlet, StampPact) | Track promises between people | You fill them in by hand |
| OPay Shield Pay | Escrow | Holds money; doesn't record what was said |

**DEXTRA captures the spoken agreement at the moment it happens, and the *other person* confirms it in their own Telegram.** Nothing counts as agreed until they tap.

## How it works

```
G2 mic ──► phone WebView (45 s memory-only ring buffer) ──hold──► server
server ──► Deepgram (speech-to-text + who spoke) ──► the LLM (free Groq tier) proposes commitments
       ──► core validator keeps only commitments backed by that speaker's exact words
lens   ◄── two-line card ──tap──► Telegram business bot sends it as you, into their chat
their tap: Confirm ──► SHA-256 record + shared Telegram checklist (sendChecklist)
           Change  ──► their correction comes back to your lens to accept
```

**The LLM proposes, deterministic code decides.** Every proposed commitment carries a verbatim quote. `packages/core/src/validate.ts` drops any commitment whose quote doesn't appear in what *that speaker* said (`UNSUPPORTED_BY_TRANSCRIPT`). A test proves an invented "pay $5,000" never reaches the lens.

## Privacy and safety

- **Audio:** never written to disk. It is held in phone memory for 45 s, sent once when you hold to lock, then dropped.
- **Transcripts:** unconfirmed drafts are deleted after 24 h. A confirmed record keeps only the commitments and their quotes.
- **Consent:** the counterparty sees exactly what they confirm. Telegram Bot Developer ToS 5.4 is respected: no business-chat content goes to any third-party API.
- **Keys:** server-side only. The `.ehpk` bundle contains no secrets.

## Setup

| Variable | Used for |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | The bot (from @BotFather). Turn on **Secretary Mode** (Bot Settings ▸ Secretary Mode) |
| `DEEPGRAM_API_KEY` | Speech-to-text with speaker diarization |
| `GROQ_API_KEY` | Commitment extraction on the free Groq tier (`openai/gpt-oss-120b`, JSON-schema output, no card). `ANTHROPIC_API_KEY` is an optional paid alternative |

Missing keys don't crash the server. The affected feature returns a typed refusal, e.g. `STT_NOT_CONFIGURED`.

## Proof

| Check | Command |
|---|---|
| Unit and integration tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Simulator end to end | `npm run e2e` |
| Extraction eval (precision, recall, invented commitments that got through) | `npm run eval -w @dextra/server` → `evidence/eval-commitments.json` |

## What existed before Nov 23

Nothing of DEXTRA. Everything in this repo was written during the build week.

Third-party libraries used:

- `@evenrealities/even_hub_sdk`
- grammY
- Hono
- `@anthropic-ai/sdk`
- chrono-node
- `@noble/hashes`
- zod

## API feature requests (for the Even and Telegram teams)

1. **Even:** an OS-drawn exit dialog in the simulator, so `shutDownPageContainer(1)` can be checked without hardware.
2. **Even:** `speakerRole` and `direction` in the simulator's audio events, so speaker-aware apps can be tested.
3. **Even:** plugin access to Even AI's on-device speech-to-text.
4. **Telegram:** let business bots message a contact outside the 24 h window, with explicit user consent.
5. **Telegram:** a Bot API way to confirm inline-button callbacks on business messages.
