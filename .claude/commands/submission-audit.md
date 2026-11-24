Audit DEXTRA against the Heads Up submission. Run before submitting, and again after fixes.

1. **Checklist (with links):**
   - public repo with a setup README
   - demo video ≤ 3 min (simulator or G2)
   - short description: problem, who it's for, how it works, track
   - optional: up to 5 API feature requests
   - optional: `.ehpk`
   - README says what existed before Nov 23
2. **Score against the rubric:** Usefulness 30 / Read & write 25 / Technical 20 / UX 15 / Business & safety 10. Give evidence per line.
3. **Build health:**
   - `npm run typecheck && npm test && npm run build` all pass.
   - `git ls-files` shows no `.env`, keys or tokens.
   - `grep` the glasses bundle (`apps/glasses/dist`) for `sk-`, `api_key` and bot tokens; expect zero hits.
4. **Numbers match:** every number in the README, video script, deck and SUBMISSION.md matches `evidence/claims.json` and live output.
5. **Even QA rules:** `app.json` (package_id format, name ≤ 20 with no "Even", edition 202601, min_sdk 0.0.14+, every permission used), root double-tap exit dialog, no black screen on first run.
6. **End-to-end:** walk the demo runbook end to end on the simulator and report what fails. Then run santa-method and the gan-evaluator agent.
