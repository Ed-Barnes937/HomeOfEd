# 02 — Powder slides one random diagonal, not both

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)

Silt's powder kernel (`kernels.ts` — `powder()`) coin-flips which diagonal to
try *first*, then tries the other: a blocked grain with any open diagonal
always escapes (at `slide: 1`, which is every powder in the roster).
Sandspiel checks **one** random diagonal per tick and stops
(`species.rs update_sand`): a grain wedged in a notch that only opens one way
escapes 50% of frames instead of 100%. That stochastic stickiness is what
produces rounded conical piles with a stable repose angle — always-escape
logic gives shallower, harder-edged piles.

## Design

- In `powder()`, drop the second `tryMove` (`api.tryMove(-first, 1)`). The
  coin now picks *the* diagonal, not the order.
- **The chunk-sleeping trap this creates:** a grain whose only escape is
  left, on a tick where the coin says right, now writes nothing — and its
  chunk would sleep with the grain frozen mid-notch, never getting its 50%
  redraw. Sandspiel has no sleeping so never meets this. The fix is the same
  shape the liquid kernel already uses: when the tried diagonal fails but
  the untried one is open (`api.canMove(-first, 1)`), call `api.keepAwake()`.
  The grain stays stochastic *and* stays scanned.
- `slide` semantics shift: a one-sided notch is now escaped with probability
  `slide × 0.5` per tick instead of `slide`. That steepening is the point of
  the ticket, but eyeball the three powders (sand, sulphur — and mud at
  `slide` whatever it declares) in case any wants retuning.
- Keep the existing "no `slide === 1` short-circuit" property: the RNG draws
  a branch takes should stay a function of the world, not of tuning. The
  stream *will* change relative to today (one fewer `tryMove` per blocked
  grain) — exact-layout tests shift, determinism (same seed → same world)
  does not.

## Tests

- Update whatever pinned layouts move; the determinism test must stay green
  untouched.
- One new unit test for the trap: a grain whose only open diagonal is on the
  untried side must still be awake next tick (assert via `scannedLastTick`
  or the chunk's awake state), and must eventually escape under a seed that
  makes the coin land its way.
- Pile shape is the payoff but is statistical — assert it loosely if at all
  (e.g. pour N grains from a point emitter with a fixed seed and assert the
  pile is taller/narrower than a recorded both-diagonals baseline), or leave
  it to eyeballing in the dev app and say so in the Answer.

## Constraints

- Two-line behaviour change plus the `keepAwake` guard — keep it that small.
  No archetype or `Api` surface changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green;
  `pnpm --filter silt run bench` before/after (the `canMove` check adds a
  read on the blocked path; `scannedLastTick` will rise slightly since
  wedged grains now stay awake — both worth knowing, neither expected to
  matter).

## Answer

Done as specified — the second `tryMove` is gone, and a blocked grain whose
untried diagonal is open calls `keepAwake()`. Reasoning and numbers in
[ADR 0039](../../../docs/adr/0039-silt-powder-tries-one-diagonal.md).

**The pile-shape payoff is not what the ticket claimed, and it was worth
measuring rather than eyeballing.** The ticket's suggestion was to assert
loosely or leave it to the dev app; two throwaway probes were cheap and settled
it instead. The numbers are in the ADR; the conclusion is:

A poured cone is **identical to the cell** either way — the settled angle of
repose does not move at all, and it could not have. A world is settled exactly
when every grain has its down cell and both diagonals blocked, which mentions
neither the coin nor the rate; the change alters how fast a one-sided grain
leaves, never whether it leaves. Same settled set, same angle. The ticket's
"shallower, harder-edged piles" is not what the old kernel was producing.

The real difference is transient, and it is a feel win: a collapsing column
takes **~2.2× as long to settle** and ends about a cell taller and narrower.
Sand avalanches as a stepped granular flow instead of draining like a liquid.
No powder was retuned — with the settled geometry unmoved there is nothing to
compensate for.

**Costs.** Wedged grains stay awake, so an active world scans more: bench mixed
world 0.492 → ~0.57 ms/tick (scanned 6359 → 6834), reaction churn 0.627 → ~0.64
(1766 → 1832). Plant growth and the settled world are unchanged — a settled
pile still sleeps completely, since a grain with both diagonals blocked writes
nothing and asks for nothing. ~14% of an already-trivial budget against a
16.7 ms frame.

**No pinned layout moved.** The ticket expected some to; the whole suite (222
vitest + 50 iwft) was green on the change without edits, determinism included.
That is less of a coincidence than it looks — `tryMove` draws no randomness of
its own, so deleting the second one takes nothing extra out of the stream.
Two new cases in `sim.test.ts` cover the change: a one-sided notch is escaped on
some ticks and not others (40 seeds, was 40/40), and a grain left behind by a
wasted coin is still being scanned once its paint rect has run out.

## Comments

- 2026-08-28 — `/code-review` (standards + spec). Spec axis found no missing
  requirements and nothing implemented wrongly, and independently re-ran the
  mutation check. It also supplied a better argument for the repose result than
  the measurement alone: the settled *set* of configurations is identical under
  both kernels, so the angle cannot move and only path-dependence can shift
  where a given pile lands. That reasoning is now the ADR's, replacing the
  hand-wave about geometry.

  Standards axis found three real defects, all now closed. **The awake
  assertion was vacuous**: a paint keeps a chunk awake for two ticks (the dirty
  rect is double-buffered), so `expect(scannedLastTick).toBeGreaterThan(0)`
  read one tick after the wasted coin passed with the `keepAwake` guard deleted
  — only the downstream escape check had teeth. The test now filters to grains
  still stuck after both free ticks and asserts on the third; with the guard
  removed that assertion is the first to fail. Two comments were left asserting
  the claim the kernel rewrite had just refuted (`sim.test.ts`, and the liquid
  kernel's "like the powder's two diagonals" cross-reference, which this change
  invalidated). And the new `apps/silt/CLAUDE.md` rule was written as an
  absolute — "any kernel branch that declines a step owes a `keepAwake()`" —
  which is false: the liquid kernel's stray gate declines and deliberately lets
  a lone droplet settle (ADR 0038). Scoped down to a judgement with both
  examples. Both axes flagged that same over-generalisation.

  Two ADR corrections came out of it: the `slide × 0.5` figure applies only to a
  notch open on exactly one side, and the claim that the RNG stream shifts was
  wrong about its mechanism (`tryMove` draws nothing; only the cross-chunk
  tie-break does).
