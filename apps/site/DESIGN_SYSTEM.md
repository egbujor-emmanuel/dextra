# DEXTRA site: design system

Read this before touching `apps/site`. Follow it exactly.

## Subject

A spoken promise becomes a record both people keep. Roman law had exactly this: the *stipulatio*, a contract made by a spoken question and a matching answer ("Spondes?" "Spondeo."). Romans recorded such agreements on wax tablets and closed them with seals. DEXTRA does the same with glasses, Telegram and a SHA-256.

**Audience:** hackathon judges (Even Realities, TVM Ventures, Daos Hub) and people who make deals out loud. **Primary job:** show the product working on real data in the first screen, then let the visitor try to break it.

## Tokens

Flat colour only: no grain, noise or texture overlays anywhere (rejected as overused, 2026-11-25). The ground is a Pompeian fresco wall: the Caecilius Iucundus wax tablets that recorded payments and agreements were found in Pompeii.

| Name | Hex | Role |
|---|---|---|
| Pompeian red (`stone`) | `#8F2A22` | Page ground: a flat fresco wall |
| Deep red (`stone-2`) | `#7A221C` | Panels and bands on the wall |
| Lime plaster (`ink`) | `#F3E9D6` | Text on the wall (6.9:1) |
| Plaster shades (`ink-2`, `ink-3`) | `#EAD9BD`, `#E0C9A6` | Secondary text (6.0:1 and 5.2:1 minimum) |
| Fresco black (`dado`) | `#1A1413` | The lower band (try section, footer) and refusals |
| Wax / stylus | `#2B2119` / `#D9B98C` | Tablet surface and the letters cut into it |
| Seal | `#8C2F1C` | The fingerprint seal, only on wax |
| Lens | `#5CFF9D` | **Only** inside the G2 lens |

## Type

- **Marcellus** (display): inscriptional capitals for the few display lines (the motto, tablet titles). Never body text.
- **IBM Plex Sans** (everything else), with tabular numbers for times and counts.
- Monospace only for things that really are code: the SHA-256 and the `npm run try` command.
- Sentence case everywhere; no all-caps labels and no tracked eyebrows.
- No single-word accents in headlines.

## Layout

```
 DEXTRA ........................................ Try it   Open @DextraAgreeBot
 ┌──────────────── wax tablet ─────────────┐ hinge ┌──────────── wax tablet ───────────┐
 │ What was said (incised, line by line)   │  ┃▓┃  │ What was agreed (record + seal)   │
 │ voice A 113 Hz  "So you will send…"     │  ┃▓┃  │ Attrito will introduce you…       │
 │ voice B 204 Hz  "Yes, I will send…"     │  ┃▓┃  │ drafted · sent · confirmed times  │
 │ voice A 118 Hz  "Deal. I will…" ▁▁▁     │  ┃▓┃  │ ( seal: e9de2299…c14c0 )          │
 └─────────────────────────────────────────┘ ┌──────┴───────┐ ──────────────────────┘
                                             │ G2 lens       │ ← the witness, overlapping the hinge
                                             └──────────────┘
 Spondes? Spondeo.  Say what you agreed; the other person confirms it in Telegram.  [Open the bot]

 Try to slip a promise past it     ← the real validator, on stone; refused lines are struck in seal red
 Five steps on one line            ← a real sequence, so numbering is allowed here
 Proof as sentences with numbers   ← not cards
 Try it with two Telegram accounts
```

Content is left-aligned. The red wall and the two tablets are the one bold statement. Everything else stays quiet: plaster text, thin rules only where they separate real content.

## Principles

1. **Real data only.** Every line, time, number and capture comes from the eval recording, the live database, the test suite or `evidence/`. If something can't be read live, say "not answering", never a guess.
2. **One orchestrated moment.** The tablets fill in once on load: lines are incised, the lens shows the card, the seal is pressed. No fade-up on every section; no hover effects on every card.
3. **Motion answers actions.** The validator reacts as you type; buttons press.
4. **Words do one job each.** Plain verbs, sentence case, active voice. A button says what happens.
5. **Avoid the generated-page tells:** near-black with one acid accent, cream with a terracotta accent, grey grain backgrounds, card grids with one radius and one soft shadow, middle-dot meta strings, "→" appended to links, mono labels.
6. **Quality floor without announcing it:** works at 320 px, visible focus, reduced motion gets the final state with no animation, contrast ≥ 4.5:1 for text.
