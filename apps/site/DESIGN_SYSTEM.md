# DEXTRA site: design system

Read this, then `design-system/dextra/MASTER.md`, before touching `apps/site`. Follow both exactly.

## Where it comes from

- **UI UX Pro Max** (`~/.claude/skills/ui-ux-pro-max`) generated the system from its database:
  `search.py "voice AI wearable agreement record trust messaging" --design-system --variance 8 --motion 6 --density 3 --persist -p DEXTRA`.
  - Pattern: **Product Demo + Features**.
  - Style: **Brutalism / Neubrutalism**.
  - Colours: recording red `#DC2626` and waveform blue `#2563EB` on white, ink `#0F172A`.
  - Type: **Lexend** headings and **Source Sans 3** body.
  - Motion: the "Stagger List" preset (`back.out(1.4)`, 0.06 s).
- **21st.dev MCP** supplied two components, both adapted:
  - `radiumcoders/brutal-button` → `src/components/ui/BrutalButton.tsx`;
  - `daiwiikharihar/neo-brutalist-kinetic-deck` → `src/components/records/RecordDeck.tsx`. It was ported from framer-motion to GSAP Draggable, and its right-click menu was replaced with visible Flip and Next buttons.

## Rules

1. **Neubrutalism:**
   - 3 px black borders;
   - hard offset shadows (4–6 px, `#000`);
   - sharp corners;
   - flat colour.

   No gradients, no blur, no grain or noise.
2. **Colour has a job:**
   - red means recording, the primary action, and refusal;
   - blue means the measured voice pitch, "kept", and live state;
   - green appears only inside the G2 lens.
3. **The first screen is the product working:** a visible grid of cells (statement, REC with what was heard, the lens, the Telegram card).
4. **Real data only:** the eval recording's lines and measured pitch, real lens captures, the three records from the live database, the bot's exact message text, and numbers from `evidence/` and the test run. No example names, no placeholder numbers.
5. **Motion:**
   - one staggered entrance per section, using the design-system preset;
   - motion that answers an action (the gate's stamp, the deck's flip and drag).

   Everything is skipped under reduced motion.
6. **Quality floor:**
   - 44 px targets;
   - contrast ≥ 4.5:1;
   - a skip link;
   - visible focus (3 px blue);
   - no horizontal scroll at 320 px;
   - Lighthouse 100 on accessibility, best practices, SEO and agentic browsing.
