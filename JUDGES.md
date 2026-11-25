# DEXTRA for judges: a 5-minute path

**One line:** agree something out loud; your glasses turn it into a note the other person confirms in Telegram, and you both track it to done.

**Live:** bot [@DextraAgreeBot](https://t.me/DextraAgreeBot) · server [dextra-qfz7.onrender.com/health](https://dextra-qfz7.onrender.com/health) · no API keys needed to try it.

| Time | What to do | What it proves |
|---|---|---|
| 0:00–0:30 | Read the problem: spoken commitments ("deck by Friday", "I'll intro you to Sara") are remembered differently by each side, and no tool captures them **at the moment they're said** and gets the **other person's** confirmation | Usefulness (30%) |
| 0:30–1:30 | `git clone https://github.com/egbujor-emmanuel/dextra && cd dextra && npm install && npm run try`, then send the lens code to @DextraAgreeBot (`/pair XXXXXXXX`) | Zero-key setup; the official simulator runs against the live server |
| 1:30–2:00 | Telegram ▸ Settings ▸ **Chat Automation** ▸ add @DextraAgreeBot with **Reply to messages**. From a second account, send yourself "hi" | Uses Telegram's business connection (Secretary Mode), so it sends **as you** into your existing chat |
| 2:00–3:00 | Agree something near the mic, e.g. *"Send me the deck by Friday?" / "Yes, Friday. Intro me to Sara?" / "Deal."* Press **Long Press**, then **Click** to send | Read & write on glasses (25%): listen → lock → review → send, all from the lens |
| 3:00–4:00 | On the second account, tap the link in Dextra's message → **Confirm ✓**. Watch the lens change to `confirmed ✓ · Dictum, factum.` | Two-party record; SHA-256 fingerprint; live push to the lens |
| 4:00–5:00 | Tap an item in "Tap each item when it's done". Then read the attack we refuse below | Follow-through; safety (10%) |

## The attack we refuse (open with this)

An LLM listening to a conversation can **invent obligations**: someone says "five thousand would be nice", and the model writes "pay $5,000". DEXTRA lets the LLM *propose* only. Deterministic code ([`packages/core/src/validate.ts`](packages/core/src/validate.ts)) keeps a commitment only if:

- its verbatim quote appears in what **that speaker** said, on word boundaries, and is not just filler;
- any amount was actually spoken (as digits or words);
- it contains no links or handles.

Everything else is dropped with a typed code (`UNSUPPORTED_BY_TRANSCRIPT`, `DUPLICATE`), and the counterparty still has to confirm. Test: `core/test/validate.test.ts` › *drops commitments the transcript does not support*.

## Verify it yourself

| Claim | How to check |
|---|---|
| 112 tests pass (core 50, glasses 15, server 47) | `npm test` |
| Typecheck clean | `npm run typecheck` |
| Simulator end-to-end | `npm run try` in one terminal, then `npm run e2e` |
| Each safety rule has a test | [THREAT_MODEL.md](THREAT_MODEL.md) (29 invariants) |
| Data survives restarts | `apps/server/test/db-persist.test.ts`; live: pairing survived a Render redeploy |
| Telegram checklists need Premium; DEXTRA falls back honestly | Server log on a non-Premium confirm: `400: Bad Request: PREMIUM_ACCOUNT_REQUIRED; posting the record as a message instead` |

## Rubric map

| Criterion | Weight | Where it shows |
|---|---|---|
| Usefulness | 30 | A record both people agreed to, created in the conversation, then reminders until it's done |
| Read & write | 25 | The lens is the whole loop: listen, lock, review, swap, pick a recipient, send, accept a change, see confirmation |
| Technical | 20 | Speaker attribution (voice separation → pitch → LLM turns), quote-backed validation, typed state machine, Telegram business connection, live deploy |
| UX | 15 | One gesture per step, two-line cards, honest refusals (`NO_SPEECH`, `CANNOT_REPLY`) on the lens |
| Business & safety | 10 | Consent by design (nothing counts until they tap), audio never stored, invented obligations refused |
