# 05 — The water cycle: evaporation, quench, wet biomass, ash regrowth

**Status:** done
**Type:** task
**Blocked by:** 02, burnables epic merge (ash 19 and the ignition ladder)
**Spec:** [../spec.md](../spec.md) §4.5, §2.7, §6, §7.2, §7.3

**What to build:** the sinks and returns that make water circulate instead of
standing. Every rule transmutes; none deletes (spec §7.3).

- **Thin-film evaporation** (ruling 1 — Ed's explicit choice over the
  measured shallow-pool variant, see spec §6): a WATER cell with open air
  above and a non-water cell below may become steam, coarse probability
  tuned so a film clears in ~300–800 ticks. **The humidity brake is
  deliberate and load-bearing**: steam directly above blocks evaporation.
  Level pools 2+ deep and ponds are immortal — by design.
  - **The risky half is keep-awake**: settled water sleeps, so a film under
    a sleeping chunk never evaporates. Growth solved this with a disguised
    `ra` write, but water's `ra` is the liquid opinion field (ADR 0038) —
    do NOT collide with its bits. Spec §8 says: if this is the third hook
    needing keep-awake, promote a real `keepAwake` on `Api` instead of a
    third disguised write. That is likely the right move here — decide with
    a measurement, record it in the evaporation ADR.
- **Quench**: `fire + mud -> steam + dirt` — fire touching wet soil dies
  into steam and dries one cell. Fire spreads through plants, never along
  the ground, and the bank below survives (ticket 02's guarantee).
- **Wet biomass steams** (spec §2.4 — the engine cannot do probability
  splits, so this is per-species): stalk and stem keep their burnables-ladder
  ignition rows (become fire); flower and sprout rows become STEAM instead —
  dry parts burn, wet parts return their water to the sky. This deviates
  from the prototype's split-based rule deliberately; validate the burn
  still propagates through a meadow (the prototype found single sparks die
  on 1-cell stems — a dragged torch or an ember reaching the stalk is the
  expected ignition story, don't over-buff).
- **Ash regrowth** (burnables owns `ash + water -> mud`): verify end to end
  that a burnt bed under its own rain re-wets and the bank regrows it.

## Acceptance

- [x] A film on saturated ground clears in the target window; a stone pond
      and a level 2-deep pool are volume-stable over a long seeded run.
      A lone film cell lifts in 3-281 ticks over 8 seeds (the rate the prototype
      tuned); a 13-cell poured puddle is off the bed in 195-1659. A nine-deep
      pond and a level 2-deep pool beside it: 251 cells -> 251 over 8000 ticks on
      three seeds, with `scannedLastTick` at 0.
- [x] Conservation soak test: free water + steam + mud (+ biomass proxy)
      constant through pour/burn/rain cycles on a closed scene.
      Sealed box, dirt bed, pour + torch + the rain that followed: drift **zero
      at every one of 3000 ticks**, two seeds. The quench row leaving smoke was
      the one leak in the table and is now steam.
- [x] Torch a meadow: steam plume, rain, ash washed to mud, bank germinates
      into the clearing - recovery on the order of 500-3000 ticks.
      Standing plants gone in 10-12 ticks, plume 36-38 cells, bed wet again by
      369-379, first new crown 370-2088. With an ash drift on the bed the burn's
      own rain washed some of it in and the crown was up in 237-1517.
- [x] Chunks under a finished (dry or fully wet) bed sleep - no permanent
      keep-awake (measure, don't assume).
      `scannedLastTick` 0 over a saturated bed, a dry bed, a pond and a level
      2-deep pool. Free water over ground that *cannot* absorb it is the
      exception, and deliberate - see below.
- [x] ADRs: thin-film evaporation recording the any-surface trap and the
      declined shallow-pool numbers (spec §7.2); the water ledger (§7.3).
      Two: [ADR 0044](../../../docs/adr/0044-silt-thin-film-evaporation.md) and
      [ADR 0045](../../../docs/adr/0045-silt-the-water-ledger.md). Split because
      one is a mechanism with rejected alternatives and the other an invariant
      every future reaction row has to obey - different readers, different
      lifetimes.
- [x] Verify loop green.
      `pnpm lint` and `pnpm typecheck` clean; vitest 359 passed with only the
      four pre-existing `interactionGraph.test.ts` reds (open regen PR #124), and
      the graph doc regenerated so its drift test is green again; Playwright CT
      51 passed.

## What building it turned up

- **Keep-awake: promoted, not disguised, and the trigger fired for the reason
  rather than for the count.** Water's `ra` is the *enforced* liquid opinion field
  (`applyArchetype` is handed a `raIsFree` flag), so the growers' trick was not
  available here at any price - this hook has no byte of its own at all.
  `keepAwake` moved from `MovementApi` to `Api`, and `CellApi` already implemented
  it. Measured rather than assumed: a film holds its chunk awake until it lifts,
  and a pond surface, a roofed film and a finished bed all scan 0.
- **A fall is not a film** - the one deviation from the prototype, and it was
  measured. The prototype lifted any water with air above it, which on a 200-cell
  grid hands a falling droplet a draw every tick of its fall: 200 droplets
  released 100 cells up landed 87-107 with air-below allowed and 179-183 with it
  refused, 55-74 against 3-9 still aloft at 400 ticks. Half a burn's plume never
  coming back down is the any-surface trap in miniature.
- **A drain needs somewhere to drain to.** Free water over ground that cannot
  absorb it - stone, or a bed already saturated - lifts, rains, lands and lifts
  again indefinitely, so that world never sleeps. Over soil it terminates,
  because `water + dirt -> mud` is a sink. Recorded in ADR 0044 as a consequence
  rather than papered over.
- **The cycle is closed under fire and open under old age.** A burnt flower hands
  back exactly the cell of soil its germination drank; a flower that *withers*
  does not, because the stem crumbles to nothing and the flower becomes a seed
  (ADR 0043's split meeting ruling 2's plant drinking). So ticket 04's extinction
  horizon is **not** beaten on an unburnt bed: measured over two seeds to 40,000
  ticks, a 261-cell bed with a one-deep sheet of water on it still thinned to
  nothing by 25,000-30,000. Both obvious closures are wrong - stem-to-steam
  inflates the ledger eightfold, flower-to-steam costs the meadow its only
  reproduction step - so ADR 0045 §4 names the hole and leaves it to ticket 06.
- **Adding a hook to water moved the world.** Water is the most common element in
  the suite, so the new rows and the new draw broke 29 cases. All but three were
  table-order lists or one-for-one ledgers that now have to count steam as well.
  The three real ones: two liquid-kernel cases moved to oil, because a one-deep
  sheet of water on open ground is no longer a resting state, and a third gained
  a lid.
- **The fire brush already has its guard.** Spec §8 flagged the prototype's
  radius-3 fire brush excavating the soil row; the real app fixed that
  independently in
  [ADR 0042](../../../docs/adr/0042-silt-brush-fills-never-converts.md) - a paint
  stroke only writes cells that are empty. Nothing to do.

## Context pointers

- Measured (evaporation prototype, 4 seeds): thin film — poured 13-cell
  puddle clears 644–864 ticks, pond exactly stable over 60k, ledger drift 0;
  any-surface — puddle NEVER clears (it manufactures its own rain, ~40% of
  water aloft), pond half-life ~1000 ticks. Chosen `evapP` 0.03 every 4.
- Primary source: `evaporation.html`, branch `proto/silt-life-followup` —
  all three rule variants behind a toggle, with the conservation ledger.
