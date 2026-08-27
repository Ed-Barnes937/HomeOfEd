# 02 — Powder slides one random diagonal, not both

**Status:** needs-triage
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
