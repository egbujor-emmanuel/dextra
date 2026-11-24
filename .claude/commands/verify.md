Re-verify every live dependency DEXTRA relies on, then update the "Live-verified facts" section of CLAUDE.md with today's date.

- npm versions: `@evenrealities/even_hub_sdk`, `@evenrealities/evenhub-simulator`, `@evenrealities/evenhub-cli`, `grammy`.
- Telegram Bot API changelog (core.telegram.org/bots/api-changelog): any change to business connections, `sendChecklist`, or checklist updates.
- Deepgram pre-recorded API: `diarize`, `utterances` parameters still accepted (one real request with the fixture clip).
- Simulator automation endpoints still respond (`/api/ping`, `/api/screenshot/glasses`, `/api/console`, `/api/input`).
- Even Hub QA rubric (hub.evenrealities.com/docs/ship/app-submission): any new rejection rule.

Report differences only. Never print secrets.
