# 01 — Engine: `set` carries a byte, coarse lifetimes, powder `move`

**Status:** ready-for-agent
**Type:** task
**Blocked by:** nothing — this is the one ticket that can go straight to main
before the burnables epic merges.
**Spec:** [../spec.md](../spec.md) §2.2, §2.3, §3 (petal row)

Three small, independent engine affordances. TDD each; they are pure engine
changes with no new elements, so nothing user-visible moves.

## 1. `set` may carry `ra`

`api.set(dx, dy, species)` gains an optional `{ ra }`:
`set(dx, dy, species, { ra: n })` writes the cell and seeds `ra` with `n`
instead of clearing it (`rb` is still reseeded — colour variants stay
engine-owned). Same for the scene builder path so scenes can pre-age cells
(the prototype needed this to stop pre-grown meadows dying as one
synchronised cohort).

This is what makes a travelling per-cell budget possible: a hook writes the
new cell *with* its state instead of swap-and-backfill (movement inside a
hook — rejected, spec §2.2). Boot validation: carrying `ra` into an element
that declares a `lifetime` is a conflict — reject it in `createRegistry`'s
spirit (loudly, not silently).

## 2. `lifetime.every`

`lifetime` gains an optional `every: n` — the countdown decrements once per
`n` ticks instead of every tick, so `ticks: 200, every: 6` outlives the
255-byte cap without widening the cell. Validation: `ticks + jitter <= 255`
unchanged; `every` in [1, 255]. The v3 prototype's flower (600–1200 ticks)
is the motivating case; its boot check caught two overflowing lifetimes.

Decide the jitter semantics deliberately (jitter in coarse units is simplest)
and document at the site.

## 3. `move` on the powder archetype

Powders gain the same optional `move` throttle liquids/gases have (a cell
moves only when `rand() < move`). Petals are a slow powder (d10,
`move ~0.25`); today only liquids and gases can be slow. Follow the existing
kernel pattern in `kernels.ts`; no behaviour change for existing powders
(default 1).

## Acceptance

- [ ] `set` with `{ ra }` seeds the byte; without it, clears as today; `rb`
      reseeds in both cases; lifetime-declaring targets are rejected at the
      call site or boot (pick one, document it).
- [ ] A `lifetime.every` element outlives 255 ticks and dies within its
      declared window; determinism test still green.
- [ ] A `move: 0.25` powder falls visibly slower than sand and settles; sand
      unchanged.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
      (use `pnpm --filter`, not `turbo --filter` — known cyclic-dep issue).

## Context pointers

- Prototype (primary source): `.scratch/silt-life-followup/prototype/above-water-life.html`
  — its mini engine implements all three (`put(x, y, sp, {ra})`, coarse
  every-N draws via `api.tick`, petal movement). Also on branch
  `proto/silt-life-followup`. Note: the prototype exposed a read-only
  `api.tick` instead of `lifetime.every`; the real engine wants `every`
  (keeps `ra` engine-owned for expiring elements). Deviation is deliberate.
