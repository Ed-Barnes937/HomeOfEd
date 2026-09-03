# 01 - The ignition ladder: per-fuel fire probabilities

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md) §1

Split the single `fire + flammable, p 0.4` row (`v1Reactions` row 3,
`apps/silt/src/sim/elements.ts`) into per-fuel rows so each fuel has its own
ignition character, keeping the tag row at the tail as the fallback for future
flammables.

## Design

New rows, inserted where row 3 sits today (specific rows first, tag row last
among them):

```ts
{ a: 'fire', b: 'sulphur', p: 1,   aBecomes: 'fire', bBecomes: 'fire' },
{ a: 'fire', b: 'oil',     p: 0.9, aBecomes: 'fire', bBecomes: 'fire' },
{ a: 'fire', b: 'vine',    p: 0.6, aBecomes: 'fire', bBecomes: 'fire' },
{ a: 'fire', b: 'seed',    p: 0.3, aBecomes: 'fire', bBecomes: 'fire' },
{ a: 'fire', b: 'moss',    p: 0.2, aBecomes: 'fire', bBecomes: 'fire' },
{ a: 'fire', b: 'flammable', p: 0.4, aBecomes: 'fire', bBecomes: 'fire' },
```

- **Wood is deliberately absent** - ticket 02 gives it `fire + wood -> ember`.
  Until 02 lands, wood keeps igniting via the tag fallback at 0.4; that interim
  behaviour is fine and needs no shim.
- **Ordering is load-bearing and silent**: `resolvePairs` keeps the first
  registration per pair, so every specific row must precede the tag row or it
  never lands. Same trap as `acid + wood`; extend the comment there or write a
  matching one.
- `lava + flammable, p 0.15` is untouched - lava stays the slow heat source
  for every fuel (ticket 02 carves wood out of it separately).
- All ps are starting points; ticket 04 owns the tuning pass. Do not bikeshed
  the values here - pin the *ordering* (relative ranks) in tests, not exact
  probabilities.

## Tests

- `fire.test.ts` has `registers rows 1-4 in the declared order` pinning the
  head of the table - update it to pin the new head, including that every
  specific `fire + <fuel>` row precedes `fire + flammable`.
- A registry-level test that the specific row won: e.g.
  `registry.reactionFor(FIRE, SULPHUR)` has `p: 1`, not `0.4` - this is the
  test that fails if someone reorders the table.
- One behavioural case for the two ends of the ladder, in the wedged-pocket
  style (`pocket()` in `fire.test.ts`): fire beside sulphur ignites it on the
  first tick (p 1, deterministic); fire beside moss usually does not.
- The vine-fuse payoff is statistical - assert loosely if at all (a grown vine
  line lit at one end is fully consumed within N ticks under a fixed seed), or
  leave it to the dev-app eyeball in ticket 04 and say so in the Answer.
- Determinism test stays green untouched.

## Constraints

- Data rows and tests only - no engine, kernel, or type changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
  (`turbo run --filter` is broken for this - use `pnpm --filter silt run ...`).
- Reaction-table growth is O(1) at runtime (the pair table is pre-resolved),
  so no bench needed for this ticket alone.

## Answer

Landed as specified: the five per-fuel rows sit where row 3 was, with
`fire + flammable, p 0.4` behind them as the fallback and `lava + flammable`
untouched. Wood has no row and keeps igniting through the tag fallback.

**The vine fuse is deferred to ticket 04's dev-app eyeball.** No statistical
assertion was written for it. What the tests do pin is the mechanical half -
that vine's row won over the tag row and that its `p` outranks seed's and
moss's - which is what would actually break if the table were reordered. A
"a lit vine line is consumed within N ticks" assertion would have needed a
grown vine, and it would have been measuring the growth hook and the fire
lifetime as much as the ignition row; ticket 04 owns that judgement in play.

Tests in `apps/silt/src/sim/fire.test.ts`:

- the declared-order pin now covers rows 1–9 (the five fuels, the tag row,
  `lava + flammable`), plus a separate invariant test that every specific
  `fire + *` row precedes `fire + flammable` - written as an invariant, and
  over both orderings of a pair, so it survives ticket 02 appending
  `fire + wood` whichever side fire is written on.
- a registry-level test that `reactionFor(FIRE, SULPHUR).p` is 1 and that the
  ladder's ranks descend sulphur → oil → vine → seed → moss, with
  `reactionFor(FIRE, WOOD).p` still equal to the tag row's own `p`. Ranks
  rather than values, so ticket 04's tuning does not have to touch this.
- both ladder ends behaviourally, over 40 seeds of a wedged pocket: sulphur
  lights on the first tick in 40/40, moss in 11/40.

The three other order pins (`acid.test.ts`, `soil.test.ts`, `life.test.ts`)
were slid along by the five inserted rows - mechanical, no intent changed.
