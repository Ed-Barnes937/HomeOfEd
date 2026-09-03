import type { Api } from './types.ts'

/**
 * Thin-film evaporation (life spec §4.5, ruling 1) - the roster's sixth `onTick`,
 * and the sink that stops standing water standing. Water that lands on ground
 * already saturated has nowhere to go: `water + mud` is not a reaction, so
 * without this a poured puddle sits on a wet bed for the rest of the run.
 *
 * **Only a film lifts**: open air directly above, and something other than water
 * directly below. A level pool two cells deep has neither an air cell over its
 * floor nor a non-water cell under its surface, so it is permanent - and so is
 * every pond. That is the ruling, not a shortcut; standing water is a thing you
 * are meant to be able to make. The two alternatives, both measured, are in
 * [ADR 0044](../../../../docs/adr/0044-silt-thin-film-evaporation.md) §4-5.
 *
 * Steam already condenses back to water, so this **transmutes and never
 * deletes** - the water goes up and rains down somewhere else
 * ([ADR 0045](../../../../docs/adr/0045-silt-the-water-ledger.md)).
 */

/**
 * Per-tick chance a film cell lifts. The prototype drew 0.03 once every four
 * ticks - the coarse form `lifetime.every` uses - and a hook cannot see the
 * world's tick, so the pair collapses into one draw a tick at the same effective
 * rate, exactly as `GERMINATE_P` does.
 *
 * **Tuned against the puddle a person pours, not against one cell.** A
 * brush-sized puddle is about thirteen cells and the last of them to go is the
 * slowest of thirteen independent draws - roughly three times the mean - so a
 * rate that clears *one* cell in the spec's 300-800 ticks leaves the puddle
 * standing for 900-2700. This rate gives a lone film cell about 130 ticks and
 * clears the poured puddle in the window the spec asks for.
 */
export const EVAPORATE_P = 0.03 / 4

/**
 * What the hook needs to know about, passed in rather than imported so this
 * module stays independent of the roster (and of a cycle through `elements.ts`),
 * exactly as `createGrowth`, `createSeedBank`, `createSprout` and `createShed`
 * take theirs.
 */
export interface EvaporationIds {
  empty: number
  water: number
  steam: number
}

export function createEvaporation(ids: EvaporationIds): (api: Api) => void {
  return (api) => {
    // **The humidity brake, and it is load-bearing** (life spec §4.5): steam
    // counts as "not open air", so a sheet under its own plume lifts far more
    // slowly than a lone droplet. Without it the plume is free and a wide sheet
    // evaporates as fast as a drop. There is no humidity field to track - the
    // plume *is* the field.
    //
    // No keep-awake on this path. The roof is either static, in which case this
    // cell genuinely has no business next tick, or it is a gas, in which case it
    // writes every tick it drifts and wakes this cell itself.
    if (api.get(0, -1) !== ids.empty) return

    // **A film rests on something.** Two cells are refused here:
    //
    // - **water below is a pool, and pools are immortal** (ruling 1). One cell
    //   down and no further, well inside `CHUNK_MARGIN`; the shallow-pool
    //   variant that reads two down is recorded as declined rather than as
    //   impossible, with its numbers, under ADR 0044's alternatives.
    // - **air below is a *fall*, not a film**, and this is a measured deviation
    //   from the prototype, which lifted any water with air over it. Falling
    //   water gets a draw a tick for as long as it falls, so on this grid a
    //   hundred-cell fall loses `1 - (1 - p)^100` - about half - and the half
    //   that lifts rises, condenses and falls again. That is the any-surface
    //   trap in miniature: the rule meant to dry standing water manufactures
    //   permanent cloud instead. Measured over 200 droplets falling 100 cells
    //   onto a dry bed: 87-107 cells of it landed with air-below allowed and
    //   55-74 were still aloft at 400 ticks; refusing it, 179-183 landed and
    //   3-9 were aloft. See ADR 0044 §5.
    const below = api.get(0, 1)
    if (below === ids.water || below === ids.empty) return

    if (api.rand() < EVAPORATE_P) {
      api.become(ids.steam)
      return
    }

    // **The keep-awake, on the missed draw only**, and the one thing in this
    // hook that needed an engine change. Settled water writes nothing at all, so
    // a film that declined its draw would sleep and never be offered another -
    // and unlike the three hooks before it, this one cannot fall back on
    // rewriting a byte it owns: water's `ra` is the liquid opinion field
    // (ADR 0038), so a disguised write here would steer the liquid instead of
    // waking it. Hence the real `keepAwake` on `Api` (ADR 0044 §3).
    //
    // Self-terminating, as a hook has to be: the writes stop the moment the film
    // lifts, is roofed, or is buried under more water.
    api.keepAwake()
  }
}
