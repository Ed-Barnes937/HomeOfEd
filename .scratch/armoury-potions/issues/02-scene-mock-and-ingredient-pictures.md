# 02 - Scene mock and the ingredient picture question

**Status:** done (Ed picked scene A, the brewing table, and pictures P3; E7 and E8 in `decisions.md`)
**Type:** prototype
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 01, 03, 04
**Model:** opus
**Gate:** Ed's pick
**ADR:** none (Ed's picks are recorded in `decisions.md` by the orchestrator and carried into
ADR 0110 by ticket 13 and ADR 0112 by ticket 16)

## Goal

Taste-led surfaces get a cheap mock for Ed first (the token lessons: the smithy's street rework
cost more than any build). Mock two or three compositions of the potion shop's scene with the
bottle on its table, on desk and phone, and put the ingredient picture question (O6) side by side
in the phone's Pours tab. End with ONE contact sheet for Ed. No app code.

## Read first

- `spec.md`: "The experience, on a phone", "The look and the scene, in words", "Accessibility
  and reduced motion", "Shop copy", "The ingredients".
- `decisions.md` (absolute path, spec rule 3): E2, E5, O6.
- `research/experience-options.md`: Option 2, "Questions only Ed can answer" 1, 2 and 8.
- The two built shops, to match their structure and quality bar: run
  `pnpm --filter armoury run dev` (port 3011) and look at `/wands` and `/swords` on desk and at
  390x844, or read `src/shop/Counter.tsx`, `src/smithy/Anvil.tsx` and its art
  (`src/smithy/forgeArt.ts`, `anvilArt.ts`), `src/shop/Tag.tsx`, `src/styles/tokens.scss`.
- The painted front: `apps/armoury/public/street/street.webp`, the `potions` outline in
  `src/street/shops.ts` (roughly x 1190-1433, y 322-960 of the 2752x1536 painting). Crop it and
  put it at the top of the sheet: the shop inside should feel like the shop outside.

## Scope

Work only under `.scratch/armoury-potions/mock/` (absolute path, spec rule 3): plain HTML, CSS and
inline SVG, the app's fonts from `apps/armoury/public/fonts/`, screenshots taken with Playwright
(headless `channel: 'chromium'`, as `scripts/gpu-shots.mjs` launches it; no GPU needed). Keep it
cheap: no build step, no React, no three.js. The bottle is a 2D SVG stand-in (a teardrop flask
with three flat colour bands, a cork and a round label) at the size the real stage would draw it.

1. **Compositions**, each on desk (1440x900) and phone (390x844, the sheet open on Pours):
   - A, "The brewing table": the bottle stands front-on on a dark wooden table; shelves of jars
     fade into the dark behind; a candle low left; the recipe card on string leaning against the
     bottle.
   - B, "The night window": the bottle on a stone sill, a moonlit window behind it lighting the
     glass from the back, a candle in front; cooler and quieter.
   - C, "The alcove": a stone alcove with hanging herbs and a copper scale, the bottle on a round
     wooden stand in the middle, the card hanging from the neck.
   Each keeps the shell: the header, the panel or sheet, the scene button area, the hint. Mark on
   each where the stage's base line falls (the bottle's foot), as a fraction of the scene height,
   so ticket 09 can match it.
2. **Contrast:** every composition keeps text at WCAG AA against its ground (4.5:1; 3:1 for large
   text). Put the measured ratios for the card, panel text and hint in the `.md`.
3. **Ingredient pictures, side by side** (phone, Pours tab, the nine jars of the spec's table):
   - P1 plain swatches with the name (what ships until pictures exist).
   - P2 rendered liquid in a small jar: drawn in SVG here as a stand-in for a real-stage render in
     the settled look (O6's default).
   - P3 the ingredient itself, illustrated (a frog, a star-shaped petal, a root, a bluebell, a
     rosehip, a storm cloud, a snail, a pond): simple ink-and-wash SVG to show what painted or
     generated pictures would mean; say in the `.md` that Ed would paint or generate the real
     ones (E9 in the swords decisions: Ed generates images himself).
   - P4 a hybrid: P2's jar with a small ink label showing P3's picture.
   Same layout, same names, same sizes, so only the picture differs.
4. **The contact sheet:** `shots/02/contact-sheet.png` (absolute path), the street crop at the
   top, then A, B and C (desk and phone each), then P1-P4. Each tile labelled with its letter and
   one line of words. Beside it `shots/02/contact-sheet.md`: what each tile is, your
   recommendation, the base-line fractions, the contrast ratios, and the questions for Ed:
   "Which scene (A, B or C, or a mix)?" and "Which ingredient pictures (P1-P4)? Will you paint
   or generate them (P3, P4), or should the shop render them (P2)?"

## Acceptance

- One contact sheet and its `.md`, every tile labelled; three compositions on desk and phone; the
  four picture options in an identical layout.
- No file under `apps/` or `packages/` changes. Nothing is committed (the mock folder is
  gitignored scratch).

## Tests to write first

None: a mock is judged by Ed.

## Hand-off

Your run ends when the sheet is written. Report the path and your recommendation. The
orchestrator sends the sheet to Ed alongside ticket 01's.

## Out of scope

- The 3D look (ticket 01), the shop's code, the pour picker's behaviour (ticket 08).
- Final art: ticket 13 builds the picked composition properly.

## Comments
