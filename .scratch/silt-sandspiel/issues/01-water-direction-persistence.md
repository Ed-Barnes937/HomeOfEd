# 01 — Water directional persistence (the opinion field)

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)

Silt's liquid kernel re-rolls its lateral direction fresh every tick
(`kernels.ts` — `const along = api.randInt(2) === 0 ? -1 : 1`), so a body of
water is a fog of independent per-cell decisions: puddles jitter and slosh
rather than flowing as currents. Sandspiel's water (`species.rs
update_water`) fixes this with three stacked mechanisms:

1. **Persistent direction** — the parity of a scratch byte is the cell's
   preferred left/right, kept between ticks, so a cell commits to a
   direction.
2. **Opinion contagion** — every successful lateral move converts one random
   neighbour of the same species to the mover's parity. Direction spreads
   through the liquid like a majority vote, and the body organises into
   coherent currents.
3. **Momentum with decay** — a successful move sets a small counter; while it
   is nonzero a blocked cell only decrements it; at zero, a blocked cell with
   an open cell behind flips parity. Water presses against a wall for a few
   frames, then the reversal propagates back up the current as a wave.

## Byte budget

`ra` is engine-owned by `lifetime`, but none of the four liquids (water,
lava, oil, acid — `elements.ts`) declares one, so `ra` is unclaimed for all
of them — the same carve-out moss and vine already use
([ADR 0035](../../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md) §3).
`rb` stays untouched (colour variant owns it — ticket 03).

Proposed packing, all inside `ra`:

- bit 0 — direction parity (even = one way, odd = the other, as sandspiel).
- bits 1–3 — momentum counter (0–7; sandspiel uses 6 and 3).
- bit 7 — "seeded" marker: `grid.write` clears `ra` to 0, so all fresh water
  would otherwise share one parity and the whole pour would lean. The kernel
  seeds `ra` from `api.rand()` (with bit 7 set) on the first tick it sees
  `ra === 0` — the same "0 means not seeded yet" convention `applyLifetime`
  uses.

Gate the whole mechanism on "liquid archetype AND element has no `lifetime`"
so a future liquid *with* a lifetime degrades to today's coin-flip rather
than corrupting its countdown. The registry can validate nothing claims both.

## Design

- All of it lives in the liquid kernel (`kernels.ts` — `fluid()` /
  `spread()`), which is the right home under "archetypes own movement".
  The falling and diagonal steps are untouched; only the lateral (`along`)
  choice changes from a coin to the stored parity.
- Contagion writes a *neighbour's* `ra`, which the `Api` surface cannot do
  (its `ra` accessor is cursor-only). `MovementApi` gains one narrow method
  for it (e.g. `convert(dx, dy)` — flip the parity of a same-species
  neighbour). Route it through the grid's normal write path so it marks the
  chunk dirty — contagion writes are also what keeps a flowing body awake.
- All randomness through `api.rand()` / `api.randInt()` — the determinism
  test must stay green.
- The `canFlow`/`keepAwake` bookkeeping must stay in step with the new
  lateral rule: a cell whose parity points at a wall but whose other side is
  open has a move available *after a future bump*, and its chunk must not
  sleep while the momentum counter runs down. Momentum-decrement ticks write
  `ra`, so they keep the chunk awake for free — check the bump case writes
  too.
- Mechanisms 1+2 are the core; 3 (momentum) is what stops instant flip-flop
  at walls. Implement all three, but evaluate feel after 1+2 — if plain
  persistence + contagion already reads well, momentum can be dropped and
  the packing simplified.

Consider a `/prototype` pass first: the payoff is entirely visual (coherent
currents, faster levelling), and the cheapest way to confirm the feel is a
throwaway before the ADR and tests are written.

## Tests

- `liquids.test.ts` pins the sealed-pocket and mid-fall cases that keep
  `canFlow` and the kernel in step — they must keep passing.
- New unit tests: a stepped pool levels in bounded ticks (the prototype
  refuted "measurably faster" — see Comments — so do not assert speed against
  the old kernel); parity spreads (paint a puddle, tick, and assert
  neighbouring parities converge); a wall-blocked current reverses after the
  momentum window rather than immediately.
- Determinism test unchanged: same seed, same world.
- Expect existing exact-layout assertions to shift — the RNG stream changes.
  Update them; that is the cost of the feature, not a regression.

## Constraints

- New ADR recording the liquid claim on `ra` (extends the ADR 0035 pattern),
  plus the byte-ownership entry in `apps/silt/CLAUDE.md` updated in the same
  change.
- No new archetype; the closed set of four stands.
- Scenes persist `ra`, so saved water keeps its direction across a load —
  fine, but `sceneCodec` needs no change; note it in the ADR.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green; run
  `pnpm --filter silt run bench` before/after — contagion adds one neighbour
  write per moving liquid cell and the ticket should know what that costs.

## Comments

- 2026-08-27 — `/prototype` pass built:
  [`../prototype-water-opinion.html`](../prototype-water-opinion.html) (single
  file, double-click). Both kernels side by side on one seed, with the ticket's
  exact `ra` packing; toggles for contagion and momentum; scenarios: pour, dam
  break, stepped pool, wall slam. Early headless numbers (dam break, 1500
  ticks, roughness<0.8 = "level"): water conserved in all variants; parity
  agreement organises to 0.92–0.98; but the opinion variants crossed the level
  threshold *later* than baseline (tick 84 / 137 / 177 vs 82) — committing to
  one direction halves lateral throughput vs try-both-sides, so "levels
  faster" may not survive; judge by eye. Verdict pending.
- 2026-08-27 — **Verdict: validated.** Ed ran the prototype with the default
  config (all three mechanisms on) and confirmed the feel — implement
  persistence + contagion + momentum as designed, packing unchanged. The
  "levels faster" claim is dropped (see the headless numbers above); the win
  is coherence, and the Tests section now asks for bounded-tick levelling
  only. Prototype kept as a primary source on branch
  `silt-water-opinion-prototype` (single file, double-click to rerun).
  Status → ready-for-agent.
- 2026-08-28 — **Implemented**, all three mechanisms, packing exactly as
  proposed. [ADR 0038](../../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md)
  (0037 was taken by sprout) plus the byte-ownership entry in
  `apps/silt/CLAUDE.md`. `MovementApi` gained `raAt`/`setRaAt` rather than the
  suggested `convert(dx, dy)`, so the bit packing stays in the kernel that
  defines it. No registry refusal: the `raIsFree` gate already degrades a liquid
  with a lifetime to the coin flip, which is the safer failure.

  Two results worth carrying forward.

  **No exact-layout assertion moved.** The ticket expected some to; the whole
  suite passed unedited (219 vitest + 50 iwft). Only one assertion changed, and
  for the opposite reason —

  **A levelled pool now goes completely still, which it never did before.** The
  coin re-drew every tick and a cell with a neighbour kept finding one of its
  two sides open, so an unconfined pool shuffled for ever. Bench `settled world`
  went 0.052 → 0.006 ms/tick with `scanned` 275 → 0, and that is real settling,
  not lost simulation: the pool spreads 71 → 120 columns, conserves all 1562
  cells and ends 13–14 deep across the span. `liquids.test.ts` now pins
  `scannedLastTick === 0` where it allowed under 100.

  Bench elsewhere is flat to slightly better (mixed 0.549 → 0.506, churn
  0.674 → 0.633, plants 0.751 → 0.759), so the extra neighbour write per moving
  liquid cell costs nothing measurable.
- 2026-08-28 — `/code-review` (standards + spec). Spec axis found no defects and
  confirmed the kernel is semantically equivalent to the validated prototype.
  Standards axis found one real gap, now closed: the ADR sold the `raIsFree`
  gate as "enforced, not just documented" but nothing tested it, since no roster
  liquid declares a lifetime. `liquids.test.ts` now registers a throwaway one
  that does; removing the gate makes it fail with `ra` at 131 (a packed opinion)
  instead of 195 (the countdown), which is the corruption the gate exists to
  stop. Also took two naming notes — `convert` → `recruitNeighbour`, and
  `fluid`'s flag → `useOpinionField` so it no longer reads as a different
  concept from `applyArchetype`'s `raIsFree`.
