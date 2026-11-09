# 02 - Spike: can a bent, noisy wand read as a branch?

**Status:** ready-for-agent
**Type:** prototype
**Spec:** [../spec.md](../spec.md)
Blocked by: none

A throwaway spike on its own branch (`spike/armoury-branch`, never merged),
inside the real app so it uses the real stage, wood and lighting. It answers
questions for ticket 05; it doesn't ship code.

## Questions to answer

1. **Does it look like a branch?** Bend the wand along a gentle curve, add
   low-frequency radius noise and a few knots (local bumps in angle and z).
   Benchmarks: Bellatrix, c1, Harry's handle. Find which ingredients matter:
   is a bend alone a bendy stick? How much noise before it looks melted? Do
   knots need the stain to pool around them?
2. **Is "bend after building" enough?** Build the straight mesh as today, then
   map each vertex through a spine (point plus frame at each z). Does that keep
   the mesh valid, normals right and the wood grain following the bend? Or does
   the bend need to live inside `radiusAt`?
3. **What breaks downstream?** Try a bent wand in: the box (`BoxPose`, fitting
   in `stage.ts`), the close look's grip and turn (`CloseUpStage.tsx`), the
   figure-of-8 wave and tip position (`wave.ts`, the tip glow), the share
   picture (`share/shareCard.ts`), handle thumbnails. List each break and the
   likely fix.
4. **Is a "Kind of wand" picker needed?** Do branch params make sense next to
   turned-wand params (a ringed handle on a gnarled branch?), or do they want
   their own kind with its own controls and defaults?

## Output

- Screenshots on a real GPU of 3-5 branch attempts, with the settings that made
  each.
- An `## Answer` below with the four answers and a recommended shape for
  ticket 05 (rewrite 05's "What to build" if the spike says so).
- Delete the spike branch once 05 is written up, or leave it unpushed.

## Comments
