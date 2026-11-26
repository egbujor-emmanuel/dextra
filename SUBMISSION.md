# DoraHacks submission: every form answer

Paste these as they are. Every number here matches the README, the site and `evidence/`. Fields marked **TODO** are filled on submission day.

## Project name

DEXTRA

## Tagline (one line)

Agree something out loud, and your glasses turn it into a note the other person confirms in Telegram.

## Tracks

- **Primary:** 01 Messaging & News (Telegram).
- **Also eligible:** Best Telegram integration. DEXTRA uses the Bot API as a Business-connected bot: messages are sent as the wearer, with inline confirm and done buttons, deep links and scheduled reminders.
- **Second track, as the README states:** 04 AI Assistants & Work. An LLM drafts each commitment, and deterministic code decides whether it stands.

## Short description (problem, who, how, track)

**Problem.** Most everyday promises are spoken. "I'll send the deck Friday." "Can you intro me to Sara?" They are agreed face to face, then half-remembered, and nobody wrote them down. Typing a note mid-conversation is rude. A note only you can see proves nothing to the other person.

**Who.** Anyone whose work runs on verbal agreements and Telegram: founders, freelancers, traders, sales people and community managers. In much of the world, Telegram is where business already happens.

**How.**
1. The DEXTRA G2 app keeps the last 45 seconds of conversation in phone memory only.
2. Hold the temple, and the lens shows who promised what, each line backed by the words actually said.
3. One tap sends it as you, into the Telegram chat you already have with that person. It goes through a Business-connected bot.
4. Nothing counts until they tap Confirm. The record is then sealed with a SHA-256 of what was agreed.
5. Both people tick items off with buttons. Whoever owes something gets a reminder the day before, on the day, and when it is overdue.

The AI only proposes. A commitment whose quote isn't in the transcript is dropped before it reaches the lens. That covers an invented amount, the wrong person, or a filler phrase.

**Track.** 01 Messaging & News (Telegram), plus Best Telegram integration.

## Links

| Field | Value |
|---|---|
| Repo (public at submission) | https://github.com/egbujor-emmanuel/dextra |
| Live site | https://dextra-site.onrender.com |
| Live bot | https://t.me/DextraAgreeBot |
| Live server | https://dextra-qfz7.onrender.com/health |
| Demo video (140 s: live-site walkthrough, then a live run: simulator lock and send, Attrito confirms in Telegram) | https://github.com/egbujor-emmanuel/dextra/releases/download/submission-v1/dextra-demo.mp4 (upload to YouTube unlisted if the form wants YouTube) |
| Packaged app | `apps/glasses/dextra.ehpk`, attached to GitHub release `submission-v1` |
| Judges' five-minute path | https://github.com/egbujor-emmanuel/dextra/blob/master/JUDGES.md |

## Proof (same numbers everywhere)

- **Tests:** 112 automated tests pass (core 50, glasses 15, server 47).
- **Extraction eval** (free `openai/gpt-oss-120b` on Groq): 12 labelled conversations, 17 commitments. Precision 1.00, recall 0.94, and 0 invented commitments reached the lens.
- **Threat model:** 29 safety rules, each pointing to the test that proves it (`THREAT_MODEL.md`).
- **Live run:** on 24 Nov the whole path ran with two real Telegram accounts: pair, lock, send, confirm, tick, fulfilled. Three records are in the live database.
- **Reminders:** sent by the live scheduler (cron-job.org every 10 minutes). Check with `node scripts/check-reminders.mjs`.

## What existed before Nov 23

Nothing of DEXTRA. Every line was written during the build week. The third-party libraries are listed in the README.

## API feature requests (optional, up to 5)

1. **Even:** an OS-drawn exit dialog in the simulator, so `shutDownPageContainer(1)` can be checked without hardware.
2. **Even:** `speakerRole` and `direction` in the simulator's audio events, so speaker-aware apps can be tested.
3. **Even:** plugin access to Even AI's on-device speech-to-text.
4. **Telegram:** let business bots message a contact outside the 24 h window, with explicit user consent.
5. **Telegram:** shared checklists for business bots without requiring the account to have Premium.

## Safety and data

- Audio is held in phone memory only (45 s ring buffer). Nothing is written to disk.
- No MTProto and no user-client scraping. Only the Bot API, with the user's own Business connection.
- No money is held or moved, and DEXTRA gives no financial advice.
- Keys live only in the server's environment and are never committed.

## Team

**TODO** on submission day: team name and members as registered on DoraHacks.
