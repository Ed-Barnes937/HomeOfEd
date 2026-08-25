import type { Api } from './types.ts'

/**
 * Plant growth (materials spec §5) — the one behaviour in the roster that is a
 * hook rather than a reaction row, and the first `onTick` in the codebase.
 *
 * The pure-reaction version (`moss + water → (moss, vine)`) was rejected: a
 * reaction has no direction, so it grows a blob rather than a vine, and no
 * brake, so a plant in a lake eats the lake and lowering `p` only slows it.
 */

/**
 * How many times a single plant cell may branch. `set` clears the target's
 * scratch bytes, so a freshly grown vine starts on 0 and gets its own budget —
 * the cap is deliberately on **one cell's fan-out**, and the size of a thicket
 * is bounded by how much water reaches it, not by this number.
 */
export const BRANCH_BUDGET = 2

/**
 * A rate, not a split (materials spec §1.1): how soon the one outcome happens.
 * Low enough that a plant creeps rather than snaps into place.
 */
export const GROWTH_P = 0.04

/**
 * Orthogonal, **up first, then the sides**, and never further than one cell —
 * ±1 is what keeps the hook inside the chunk margin, and the order is what
 * makes a plant climb. There is deliberately no downward step: a plant sitting
 * on a pool grows out of it rather than boring into it.
 */
const REACH: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
]

/**
 * The hook moss and vine share. Ids are passed in rather than imported so this
 * module stays independent of the roster (and of a cycle through `elements.ts`).
 */
export function createGrowth(water: number, vine: number): (api: Api) => void {
  return (api) => {
    // **`ra` is the engine's `lifetime` byte** — see the byte-ownership rule on
    // `Api`. Moss and vine declare no `lifetime`, so nothing is claiming the
    // byte and this hook may use it as its branch counter. This is the first
    // use of `ra` outside the engine, and it is only safe for as long as these
    // two elements stay lifetime-free; giving either one a lifetime silently
    // hands the byte back to the engine and breaks the brake.
    const branches = api.ra
    if (branches >= BRANCH_BUDGET) return

    for (const [dx, dy] of REACH) {
      if (api.get(dx, dy) !== water) continue
      // The **first** water neighbour in this order is the one candidate, and
      // it gets one draw a tick — that is what makes "up first" a preference
      // rather than a rounding error. Falling through to the sides on a failed
      // draw would leave a submerged plant growing up barely a third of the
      // time, which is a blob again. The draw happens only once a neighbour
      // qualifies, as `applyReactions` does it, so the RNG stream stays a
      // function of the world rather than of how much air a plant stands in.
      const grew = api.rand() < GROWTH_P
      if (grew) api.set(dx, dy, vine)
      // **Written every tick, not only when it changes.** A cell that should
      // keep acting must write or the chunk sleeps, and `Api` has no
      // `keepAwake` — writing `ra` marks the chunk dirty, so this is the only
      // lever a hook has. Settled water writes nothing at all, so without it a
      // plant in a still pond gets two or three draws and then never another.
      // The write stops as soon as the budget is spent or the water is gone,
      // so a finished plant still lets its chunk sleep.
      api.ra = grew ? branches + 1 : branches
      return
    }
  }
}
