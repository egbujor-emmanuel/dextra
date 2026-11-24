# DEXTRA: agent instructions

**What this is:** Heads Up hackathon (Even Realities G2 × TVM Ventures × Daos Hub). **Deadline 2026-11-29 19:59 UTC.**

**Pitch:** Agree something out loud, and your glasses turn it into a note the other person confirms in Telegram.

**Tagline:** *Dictum, factum.*

**Before implementing anything,** read the relevant `PRD.md` section. Never re-derive decisions from memory.

## Never lose sight of the rubric (quoted, with weights)

| Criterion | Weight | How DEXTRA scores it |
|---|---|---|
| Usefulness on G2: "Solves a real everyday moment, works at a glance and hands-free." | 30% | The end of a spoken agreement; one hold + one tap; no phone |
| Read and write: "Acting is fast: a short phrase, one tap or the ring, with smart defaults or AI drafts instead of long dictation." | 25% | The AI drafts the record from what was *already said*, so there's zero dictation. One tap sends; the counterparty taps once |
| Technical execution: "Works end to end, reliable, clean code." | 20% | core is unit-tested; real Deepgram + Telegram business bot + checklists; simulator e2e |
| UX for display and voice: "Clear on a 576 × 288 monochrome display, natural by voice." | 15% | Two lines per card; brightness hierarchy; plain refusal words |
| Business potential and safety: "Real users and demand, careful with data and money." | 10% | Viral loop through counterparties; audio never stored; both-party consent; no money |

## Originality: competitors and how we differ

| Competitor | What they do | How we differ |
|---|---|---|
| Glance Desk, GlanceReply, TapBack, Gloz and 20+ others | Telegram inbox + AI reply drafts | We create two-party records from *speech*, not reply drafts |
| Conversate (Even) | One-sided summary | Our output is confirmed by the other party |
| Vowlet / StampPact | Manual shared promises | We capture from speech, hands-free |
| Devpost "Pakka" | One-sided renter log | Same: ours is two-party |
| OPay Shield Pay | Escrow | We have no escrow and no money |

## Live-verified facts (2026-11-23)

**SDK and tooling**

- SDK `@evenrealities/even_hub_sdk` **0.0.16**; simulator **0.9.5**; CLI 0.2.0. The official template pins stale versions, so don't copy its `package.json`.

**Simulator**

- `--aid <device>` feeds the laptop mic into `audioEvent`: 100 ms frames, 3,200 B, 16 kHz s16le.
- `speakerRole` is always `"unknown"` and `direction` always `null` there.
- Automation API (`--automation-port`): `/api/screenshot/glasses` (RGBA; lit = alpha>0), `/api/console`, `POST /api/input {action}`.

**Lifecycle and display**

- Root double-tap **must** call `shutDownPageContainer(1)`.
- Browser `localStorage` does not persist in `.ehpk`; use `bridge.setLocalStorage`.
- Click arrives as `eventType` `undefined` (0 normalised).
- The simulator sends taps on `sysEvent`, hardware on `textEvent`/`listEvent`. Handle all three.
- Limits: ≤ 12 containers (≤ 4 image), exactly 1 `isEventCapture`. Text ≤ 1,000 chars on create/rebuild, ≤ 2,000 on upgrade. List ≤ 20 items × 64 chars.

**Network**

- The `app.json` network whitelist uses exact origins and is **not** a CORS bypass. The server must send CORS headers.

**Telegram**

- Bot API 10.5. Business bots have needed no Premium since 10.0.
- `sendChecklist` works only with `business_connection_id`.
- The business `can_reply` window is 24 h after the counterparty's last incoming message.
- MTProto ToS 1.5 bars AI on user-client data, so we use no MTProto.

## Invariants

- Zero mock data in product paths. Test fixtures are real recorded responses, labelled as such.
- The LLM proposes; `packages/core` decides. A commitment without a verbatim transcript quote is dropped (`UNSUPPORTED_BY_TRANSCRIPT`).
- Audio never touches disk. Never log transcripts, tokens or keys.
- No secrets in `apps/glasses`. Ever.
- Report test counts only after they pass. Every public number must match `evidence/`.

## Design tokens (lens)

- `textColor`: 4 = primary facts (names, dates, amounts); 2 = labels and hints; 1 = footer.
- Glyphs: `●` live, `◌` waiting, `✓` confirmed, `▸` action, `━` progress. No emoji (dropped by the firmware font).

## House rules

- Commit messages: conventional commits. **No AI attribution trailers.**
- Keep the repo private until the final hours (stealth). Don't push it publicly without the owner's go.
- Testnet on-chain writes (TON stamp) need the owner's explicit go-ahead before the first broadcast.
