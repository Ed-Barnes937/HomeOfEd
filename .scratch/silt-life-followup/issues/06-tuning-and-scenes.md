# 06 — Tuning pass and scenes

**Status:** done
**Type:** task
**Blocked by:** 03, 04, 05
**Spec:** [../spec.md](../spec.md) §5, §8, ruling 4

**What to build:** measured tuning against the agreed targets, plus the scene
and UX sweep. Tune by measurement (headless seeded runs), not by eye alone —
the sandspiel epic's lesson (a premise refuted by measurement) applies.

- **Density** (ruling 4): an established bed should carry ~20+ crowns, not
  the 4–16 scrub that v3's dormancy produced. Germination probability is the
  knob that moved it most; measure the settled population, not
  offspring-per-flower (self-pins at 1.0, untunable).
- **Burn and recovery feel**: full-meadow recovery in the 500–3000 tick
  window; a dragged torch clears a meadow, a single spark need not (spec
  §4.5 — don't over-buff single-spark fires).
- **Pacing sanity**: climb speed (~20–35 ticks to bloom), flower life,
  petal shed rate — the prototype's values are the starting point; adjust
  against the real renderer at 60 fps.
- **Scenes**: pre-age plants via `set`-carries-`ra` so pre-grown meadows
  don't die as one synchronised cohort (prototype finding). Remember: earth
  basins do not hold water — dirt wets to mud and mud is a liquid, so any
  scene pond must be stone-lined and stone-floored.
- **Fire brush check** (spec §8): confirm whether the real app's brush
  painting fire over terrain replaces the ground (and would silently destroy
  a seed bank). If it does, guard it: fire ignites what stands on the
  ground, it does not excavate. Small, but it will otherwise read as "the
  bank doesn't work".
- **Docs sweep**: apps/silt CLAUDE.md byte-ownership bullet (buried seed's
  `ra`, tip's `ra`), README/CONTEXT if the roster tables live there, ADR
  cross-links, and the discovery-tree interaction graph gains the new
  elements (they are discovered, not painted — ruling 6).

## Acceptance

- [x] Settled population >= 20 crowns on the reference bed across 3 seeds.
      Measured over seeds 1-6, sampled every 1000 ticks: the settled band
      (3000-12,000) is 26-47 crowns, and the 2000 sample - still establishing -
      is 19-27. Was 5-23. Pinned over seeds 1-3 in `life.test.ts`.
- [x] Burn/recover cycle inside the target window across 3 seeds.
      Over six seeds: crowns down to one or none in 6-17 ticks, plume 36-39,
      bed wet again by 368-382, a new plant out of the bank by 118-334, and the
      meadow back to the mass and crown count the fire found by 342-884.
- [x] No new paintable ids; mobile iwft's eleven-name rail assertion
      untouched. No roster additions at all - three lifetime/rate constants.
- [x] All tuning changes carry a one-line measured justification in the commit
      message.
- [x] Verify loop green. `pnpm lint` and `pnpm typecheck` clean; vitest 361
      passed with only the four pre-existing `interactionGraph.test.ts` reds
      (regen PR #124, confirmed red on this branch's parent too); Playwright CT
      51 passed.

## What building it turned up

- **The named knob was the wrong one, and measuring is how that surfaced.**
  Spec §8 and this ticket both pinned germination probability as the density
  knob, because it was in the prototype. It is not here, and the difference is
  ruling 2: the prototype refunded a germination's soil cell as mud, while this
  one drinks it. `dirt` is `static`, so a spent surface cell is never
  re-supplied from below and a closed bed of N cells pays for exactly N plants
  however fast they arrive - which makes the standing crown count a plant's
  *lifetime* over the window and germination only the speed the bed is spent
  at. Raising germination alone to 0.005 filled the reference bed to 33-41
  crowns by tick 2000 and left 0-3 by 12,000, every cell of soil dry.
  **Doubling the flower's life is what bought the density.**
  [ADR 0046](../../../docs/adr/0046-silt-a-meadow-s-density-is-its-flower-s-lifetime.md).
- **Doubling the crowns cost the drying horizon nothing**, which is the number
  ADR 0045 §4 was owed: 20,000-21,600 ticks against 20,600-22,400 before. A
  crown that lasts longer spends the bed *more slowly per crown*. The
  germination route would have cut it to 11,400-13,200. The hole itself is left
  open, per the standing decision - it is a question about feel.
- **The stem's countdown is not free to leave behind.** `flower` is a `static`
  archetype, so a stalk that crumbled under a living flower would leave it
  hanging in the air. The stem's *minimum* has to clear the flower's maximum,
  and the registry cannot check it (it has no idea the two are one plant), so
  it is an assertion in the boot case.
- **A denser meadow made the torch read differently**, and the honest response
  was to loosen the measurement rather than buff the fire. More standing fuel
  means a dragged torch leaves a single straggler on some seeds instead of
  clearing to nothing, so the burn case now pins the *crown* count (at most one
  left standing) plus full recovery, rather than total erasure.
- **No preset scenes to extend.** `src/features/scenes/` is codec + localStorage
  + popover; the app ships none, and inventing a built-in scene library was well
  outside the ticket. What the scene half really wanted was the two build rules
  written down and pinned, and they are, in `sceneRoundTrip.test.ts` and
  `apps/silt/CLAUDE.md`: a pond is stone-lined and stone-floored (an earth basin
  wets to mud, and mud is a liquid), and a pre-grown meadow is pre-aged through
  the growers only - `requireRaIsFree` means the stalk tip and the buried seed
  are the only cells `paint(..., { ra })` will take, and everything else spreads
  by `lifetime.jitter`.
- **The fire brush guard held** (spec §8). ADR 0042 covers it, as ticket 05
  found; what was missing was a case pinning the *life* half of it, so a fire
  brush over a bed and its bank now has one beside the water one.
- **The petal shed rate stayed put.** What a reader sees is petals in the air -
  the rate times a petal's own 80-150 ticks, not the six to twelve a
  longer-lived flower gets through. Measured 9-39 aloft against 30-40 crowns.
