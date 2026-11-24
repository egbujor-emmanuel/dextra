# DEXTRA: PRD (source of truth)

*Dictum, factum.* ("Said, done.")

Agree something out loud, and your glasses turn it into a note the other person confirms in Telegram.

Hackathon: Heads Up (Even Realities × TVM Ventures × Daos Hub). Deadline: **2026-11-29 19:59 UTC**.

Tracks: 01 Messaging & News (Telegram core) + 04 AI Assistants & Work. Also eligible for Best Telegram integration.

Read the relevant section before implementing. Never re-derive these decisions from memory.

---

## 1. Problem

People make spoken commitments all day:

- "I'll send the deck Thursday."
- "We'll fix the AC by Friday."
- "Scope stays at three screens for $2k."

Afterwards each side remembers it differently.

Existing options, and why each falls short:

- **Meeting notetakers** (Otter, Fireflies, Granola) only work in video calls, and they produce the note-taker's own version.
- **Conversate** (Even, first-party) keeps a summary only the wearer sees.
- **Shared-promise apps** (Vowlet, StampPact) and **Devpost "Pakka"** (a renter's evidence log) are filled in by hand by one side.
- **"Confirm it in writing later"** is the standard advice. Nobody does it, because it means typing on a phone mid-conversation.

**What is unsolved:** a record of a *spoken* agreement that the **other party confirms**, created at the moment of agreement, with no phone.

## 2. Users and the moment

| | |
|---|---|
| **Users** | Founders, investors, freelancers, consultants, sales people, contractors: anyone whose work runs on verbal promises |
| **Moment** | The end of a face-to-face conversation: "So deck by Thursday, and you'll intro me to Sara?" "Deal." |
| **What the wearer does** | Holds the temple; glances at the lens; taps |
| **What the counterparty does** | Gets a Telegram message; taps Confirm, or Amend. No glasses needed |
| **Viral loop** | Every record reaches someone new, who sees what DEXTRA does by using it |

## 3. Flow

1. **Listening (opt-in, visible).** While the plugin is open, the phone holds the last **45 s** of glasses-mic audio in a **memory-only ring buffer**. The lens shows `● listening`. Nothing is written to disk.
2. **Lock.** Long-press the temple (or tap on the idle screen). The buffer is sent once to our server as WAV.
3. **Transcribe and attribute.** The server sends the audio to Deepgram pre-recorded STT with `diarize=true`, gets utterances labelled by speaker, and discards the audio.
4. **Extract.** The LLM *proposes* commitments as JSON. Each commitment carries a verbatim `quote` from the transcript. **Deterministic code decides** (§6).
5. **Review on the lens.** Two lines, e.g. `Omar → deck by Fri 28 Nov` / `You → intro to Sara`.
   - Tap = send to the suggested counterparty.
   - Swipe = swap who is who, or pick another contact.
   - Double-tap = discard.
6. **Send.** Through the wearer's **business connection**, the bot posts into the counterparty's private chat, *as the wearer*: a short card plus a link `t.me/<bot>?start=a_<id>`.
7. **Counterparty decides** in the bot chat: **[Confirm] [Amend]**.
   - **Amend:** they type or voice the change. The server re-extracts it, and the lens shows `Omar changed: deck → Mon 1 Dec (was Fri)`. Tap = accept, double-tap = reject.
8. **Confirmed.**
   - The bot posts a **Telegram checklist** (`sendChecklist` via the business connection, `others_can_mark_tasks_as_done=true`) into the wearer↔counterparty chat, one task per commitment.
   - The lens shows `Omar confirmed ✓`.
   - The record gets a SHA-256 of its canonical JSON (and, optionally, a TON testnet stamp).
9. **Follow-through.** Checklist ticks update the record. Due-date reminders go out as Telegram messages the day before.

## 4. Architecture

```
[G2 lens] <-BLE-> [Even app WebView: apps/glasses]  --HTTPS/SSE-->  [apps/server (Hono)]
                    ring buffer, screens, input                    ├─ Deepgram (STT + diarize)
                                                                   ├─ LLM (extraction proposals)
                                                                   ├─ core (validation, state, hash)
                                                                   ├─ grammY bot (business connection,
                                                                   │   deep-link review, checklists)
                                                                   ├─ SQLite (node:sqlite)
                                                                   └─ TON testnet stamp (optional)
```

- `packages/core`: pure TypeScript with no I/O. Types, state machine, canonical hash, extraction validation, wearer attribution. **All the logic lives here and is unit-tested.**
- `apps/glasses`: Vite + TS + `@evenrealities/even_hub_sdk@0.0.16`. Container UI only. No keys in the bundle.
- `apps/server`: Hono on Node 22+, grammY, `node:sqlite`. Holds every secret.
- **Pairing:** the lens shows a 6-character code; the wearer sends `/pair CODE` to the bot. This binds the Even device to the wearer's Telegram account and business connection.

## 5. Data model and state machine

**Agreement** fields:

- `id`, `createdAt`, `wearerTgId`, `counterpartyTgId?`, `counterpartyName`
- `commitments[]`, `status`, `history[]`, `hash?`, `stampTx?`

**Commitment** fields:

- `id`, `by` (`'wearer' | 'counterparty'`), `what`, `dueISO?`, `dueText?`, `amount?`, `quote`, `done`

**Status transitions:**

```
draft --send--> sent --confirm--> confirmed --all done--> fulfilled
                 |--amend--> amended --accept--> confirmed
                 |                    \--reject--> sent (counterparty may amend again)
draft --discard--> discarded
sent/amended --expire (7 d)--> expired
```

Any other transition throws `InvalidTransition`. Every transition appends to `history`.

## 6. Invariants and policy (typed refusals)

| Code | Rule |
|---|---|
| `NO_COMMITMENT` | Extraction found no commitment. Nothing is sent |
| `UNSUPPORTED_BY_TRANSCRIPT` | A proposed commitment whose `quote` is not found (after normalisation) in the transcript is **dropped**. The LLM cannot invent obligations |
| `SINGLE_SPEAKER` | Diarization found fewer than 2 speakers. The lens still shows the card but labels it "one voice heard" |
| `NOT_PAIRED` | The device is not linked to a Telegram account |
| `NO_BUSINESS_CONNECTION` / `CANNOT_REPLY` | The wearer hasn't connected the bot under Chat Automation, or Telegram's 24 h reply window is closed. Fallback: the lens shows a share link the wearer can forward |
| `INVALID_TRANSITION` | A state-machine violation |

**Data rules:**

- **Audio is never persisted** (memory → Deepgram → dropped).
- **Transcripts** of unconfirmed drafts are deleted after 24 h. Only confirmed records keep the commitment text and quotes.
- **The counterparty sees the exact text they confirm.** Nothing is recorded as "agreed" without their tap.
- **Telegram ToS 5.4:** business-chat content is never sent to third-party APIs. The LLM only sees (a) the transcript of audio the wearer chose to lock, and (b) amendment text the counterparty typed into our bot chat for that purpose.
- **No secrets in `apps/glasses`.** Every call goes through `apps/server`.
- **Money is out of scope.** No custody, no payments, no financial advice.

## 7. Glasses UX (576×288, 4-bit green)

| Screen | Content | Input |
|---|---|---|
| IDLE | `DEXTRA` (dim) · `● listening · hold to lock` · footer `3 open · 1 due tomorrow` | long-press/tap = lock · swipe = records · 2× = system exit dialog (`shutDownPageContainer(1)`) |
| LOCKING | `Locking what was said…` | — |
| REVIEW | ≤ 2 commitment lines, brightest = amounts/dates · footer `tap → send to Omar` | tap = send · swipe = swap/next contact · 2× = discard |
| SENT | `Sent to Omar · waiting` | 2× = back |
| AMENDED | `Omar changed: deck → Mon 1 Dec (was Fri)` | tap = accept · 2× = reject |
| CONFIRMED | `Omar confirmed ✓` · `Dictum, factum.` | any = back |
| RECORDS | list (≤ 20 items, ≤ 64 chars each) | click = detail · 2× = back |
| REFUSAL | plain-words reason + code | any = back |

**Contextual menu:** Lock now · Records · Pause listening.

**Persistence:** state lives in `bridge.setLocalStorage`, *not* browser localStorage (field-tested: it doesn't survive in `.ehpk`).

## 8. Telegram spec

- **Bot API 10.x.** Updates: `message`, `callback_query`, `business_connection`, `business_message`, `edited_business_message`.
- **Contacts directory:** built from `business_message` senders, i.e. people who wrote to the wearer. Telegram only allows business-bot replies within 24 h of their last message.
- **Send as the wearer:** `sendMessage(business_connection_id, chat_id, text)`. The review link is a deep link, so it works even if inline buttons on business messages don't route callbacks.
- **Checklist:** `sendChecklist(business_connection_id, chat_id, checklist{title, tasks[], others_can_mark_tasks_as_done:true})`. Updates come back as checklist-tasks-done service messages.
- **Test environment:** the `TELEGRAM_ENV=test` path uses `/bot<token>/test/`, with numbers 99966XYYYY and code XXXXX.

## 9. Tests and evidence

- **core:** unit tests for every transition, refusal, normalisation and the hash.
- **server:** integration tests with a recorded Deepgram response fixture (a real response saved once, stored with its request) and a real SQLite DB.
- **e2e:** the simulator automation API (`--automation-port`) asserts:
  - lit pixels after boot
  - lock → review → send path
  - the root double-tap exit dialog
  - zero console errors
- **Eval:** a labelled set of conversations; precision/recall of extracted commitments; zero `UNSUPPORTED` commitments get through.
- **Evidence:** `evidence/claims.json` maps each public claim to a file, test or tx.

## 10. Scope discipline (honesty)

- **No G2 hardware on the team.** We claim nothing about on-glass `speakerRole`, "Hey Even" (Add Agent) or notification mirroring. Attribution is server-side diarization; `speakerRole` is read only as an optional hint.
- **Demo surface:** the Even simulator fed by the laptop mic (`--aid`, verified in spike K-audio), plus the counterparty's real Telegram on a second phone.

## 11. Kill gates

| Gate | Status |
|---|---|
| K1 MTProto WebSocket in the WebView | PASSED (not core) |
| K-audio: mic → simulator → plugin | PASSED |
| K5 root double-tap → exit dialog | Exit path fires (simulator e2e: lens 1830 → 0 px after `double_click`). Simulator 0.9.5 does not draw the OS dialog, so the dialog's look is unverifiable without hardware |
| K-e2e glasses ↔ server (no keys) | PASSED 2026-11-23: registration, pairing code, lit lens, 0 console errors (`npm run e2e`, 5/5) |
| K-bot: business connection receives `business_message` and can send as the wearer; `sendChecklist` works | Needs bot token + a second account |
| K-dg: Deepgram diarization on a 2-voice 45 s clip; latency budget ≤ 4 s | Needs key |
