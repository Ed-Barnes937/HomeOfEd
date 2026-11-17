# 02 - Wand close look: two lights still move under reduced motion

**Status:** needs-triage
**Type:** bug
**Raised:** 2026-11-13, found while proving the stage rigs unchanged for
armoury-potions ticket 04 (`.scratch/armoury-potions/reviews/04-r1.md`)

## What happens

With `prefers-reduced-motion: reduce`, open the wand's close look. In the first
second or so two lights still change:

1. **The tip glow flares.** `TipGlow` in `apps/armoury/src/stage/WandMesh.tsx`
   scales its orb by `1 + 2.2 * exp(-3t)` and raises its point light for about
   1.6 s after a cast, with no reduced-motion guard. Under reduced motion the
   cast lands on arrival, so the orb visibly grows and shrinks. This is a bug:
   `apps/armoury/CLAUDE.md` says no flourish, glint or burst under reduced
   motion. It dates from the original armoury PR (b0c542b29).
2. **The shop's flash plays.** `.flash` in
   `apps/armoury/src/shop/CloseUp.module.scss` is kept under reduced motion on
   purpose, shortened to 0.8 s by a media query. It is a change of light, not
   movement, so whether it should stay is Ed's call, not a bug.

## Evidence

Real-GPU shots of the unchanged code under `--reduced-motion` differ from run to
run at 1200 ms by 29 to 72 levels on the wand's close frames, and by 0 from
2400 ms on. With the flash hidden, what still differs is the tip's halo and the
light it throws on the shaft. Shots and the diff:
`.scratch/armoury-potions/shots/04/` (local, not in git).

## To decide

- Fix 1: hold the tip glow steady under reduced motion (no scale, no flare).
- Decide 2: keep the shortened flash, or drop it under reduced motion.

## Comments
