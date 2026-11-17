# 28 - The uncorking's effect shows in the air in every browser

**Status:** done
**Type:** bug
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 27 (which owns `src/apothecary/` and `src/potion/describe.ts`; do not
touch them)
**Model:** opus
**Gate:** the orchestrator reads the diff and the shots (no separate reviewer)
**ADR:** a short addition to 0111 (the close look)
**Dev port:** 3045

## The report

Ed, 2026-11-17, looking at the finished shop in his own browser (Zen, which is Firefox
underneath): "The effect that happens when the cork is removed is also only painted on the
bottle and cork? Would it make more sense to have particle effects so it looks like it's
coming from the potion itself?"

The effect already is particles that leave the neck (`src/stage/EffectShow.tsx`,
`effectKinds.ts`), and in headless Chromium on the real GPU they show in the air above the
bottle (`.scratch/armoury-potions/shots/15/r1/sheets/02-sparkling.png` in the epic
worktree). So Ed is seeing something Chromium does not show.

## A guess, not checked

The sprite's fragment shader ends `gl_FragColor = vec4(rgb * a, a * cover)` with `cover`
below 1, blended ONE / ONE_MINUS_SRC_ALPHA onto a canvas that is transparent wherever the
bottle is not. That leaves colour brighter than its alpha in the canvas. Chromium adds such
pixels to the page behind; Firefox and Safari may clamp colour to alpha, so the sprites
would show only over pixels the bottle and cork already made opaque. That would match "only
painted on the bottle and cork". Treat it as a guess: prove or kill it before changing
anything, and say what you found if it is something else.

## Steps

1. **Reproduce first, as Ed sees it.** Playwright's Firefox (`firefox-1538`) and WebKit
   (`webkit-2336`) are already in `~/Library/Caches/ms-playwright`. Never run
   `playwright install`; if the repo's Playwright wants other builds, stop and report.
   Shoot the close look's show at the effect's peak in Firefox, WebKit and Chromium for one
   bright effect (sparkling) and one smoky one (whiffy), on the same potion. `gpu-shots.mjs`
   is Chromium only: give it a small browser option if that is a few lines, otherwise use a
   throwaway script in your shots folder.
2. **Fix the cause** so the effect reads in the air in all three. Keep Chromium's look as
   close as you can to `shots/15/r1` (same frames of the same potions, side by side), keep
   `REST_CAP`, no post pass, and the asserted budgets.
3. **Look, do not fix:** one Firefox shot each of the wand's sparkle burst and the sword's
   glint in their close looks. If they have the same fault, say so in your report; a ticket
   will be filed outside this epic.
4. Tests where they prove something (the material's settings, anything pure you pull out);
   do not pin pixels. Add the decision to ADR 0111 in a few lines.

## Verify

`pnpm lint`, `pnpm typecheck`, `pnpm --filter armoury exec vitest run`. Do **not** run the
Playwright CT (ticket 27's agent is using its port); the orchestrator runs it after the
merge.

## Acceptance

- Before and after shots in Firefox and WebKit show the fault and then the effect in the
  air; Chromium before and after are close.
- Reduced motion's still arrangement shows in all three too.

## Out of scope

Changing what the effects are or how they move, `src/apothecary/`, `src/potion/`.

## Comments
- 2026-11-17 orchestrator: done, merged from `potions/28-effect-every-browser` (158d8c5b, Opus). The fault reproduced in WebKit's live show (sparkles and the reduced-motion arrangement vanish in the air, only those over the cork remain), not in Playwright's Firefox. Cause: lights left colour above alpha 0 in the premultiplied canvas; WebKit drops such pixels. Fix: each sprite's alpha is at least its brightest channel. Chromium stays close to `shots/15/r1` (whiffy's bright point in its smoke is a little softer). The orchestrator read the diff and the sheets (`shots/28/`) in place of a reviewer. After both merges: lint, typecheck, Vitest 2129, CT 189 of 189. Open: Ed to confirm in Zen itself, where the fault was reported and never reproduced; `LiquidMotes` has the same alpha line but sits over opaque liquid, left alone; the wand's burst and trail in Firefox and WebKit are ticket `.scratch/armoury/issues/07`.
