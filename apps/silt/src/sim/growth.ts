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
 * this caps **one cell's fan-out** and nothing more. What bounds a thicket is
 * `MAX_PLANT_NEIGHBOURS` below.
 */
export const BRANCH_BUDGET = 2

/**
 * A rate, not a split (materials spec §1.1): how soon the one outcome happens.
 * Low enough that a plant creeps rather than snaps into place.
 */
export const GROWTH_P = 0.04

/**
 * How many plant cells may already touch a cell for a vine to grow into it.
 * The parent is always one of them, so **one** means "nothing adjacent but the
 * plant it grows from" — and that is what bounds total growth (ADR 0035).
 *
 * Every cell grown here therefore attaches to exactly one existing cell, which
 * makes what grew an *induced forest* in the grid: no cycle can close, and no
 * two strands can run alongside each other. No 2×2 block can be grown — place
 * three of its corners and the fourth has two plant neighbours for good. So a
 * sealed pool cannot convert; growth is forced into separated strands with
 * water between them, which is both the bound and the reason it reads as vine
 * rather than as algae. (Sprouting is a reaction row and has no crowding gate,
 * so a 2×2 of seed wedged in mud *does* make a 2×2 of moss — the claim binds
 * growth, not the world. ADR 0035.)
 *
 * This is an eligibility test, not a failed draw: a crowded neighbour is
 * skipped and the next offset in `REACH` is considered, so a plant blocked
 * above still branches sideways. Falling through on a failed *draw* is the
 * thing the loop below refuses to do, and for a different reason.
 */
export const MAX_PLANT_NEIGHBOURS = 1

/**
 * Orthogonal, **up first, then the sides**, and never further than one cell —
 * the order is what makes a plant climb. There is deliberately no downward
 * step: a plant sitting on a pool grows out of it rather than boring into it.
 */
const REACH: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
]

/**
 * The four cells that count as touching a candidate. Orthogonal to match
 * `REACH`: counting the diagonals too forbids strands from running diagonally
 * past each other, which is most of the room growth has, and a plant then
 * stalls after a few cells.
 */
const TOUCHING: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]

/**
 * The hook moss and vine share. Ids are passed in rather than imported so this
 * module stays independent of the roster (and of a cycle through `elements.ts`).
 */
export function createGrowth(water: number, moss: number, vine: number): (api: Api) => void {
  /**
   * Plant cells touching the candidate at `(dx, dy)`. Moss counts alongside
   * vine — they are one organism, and the mat a seed makes is what the first
   * strand grows out of.
   *
   * **Reads reach two cells from the plant**, since the candidate is already
   * one away and this looks one past it. That is the whole of `CHUNK_MARGIN`,
   * and it is exactly enough: a write anywhere wakes every chunk within two
   * cells of it (`Chunks.touch`), so a plant blocked today is woken when the
   * cell that blocked it burns or dissolves. It leaves no slack, so a future
   * hook reading a third cell out needs the margin raised with it.
   */
  const crowding = (api: Api, dx: number, dy: number): number => {
    let touching = 0
    for (const [ox, oy] of TOUCHING) {
      const species = api.get(dx + ox, dy + oy)
      if (species === moss || species === vine) touching++
    }
    return touching
  }

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
      // Crowding is checked before the draw, so a blocked candidate costs
      // nothing: no water is spent and no branch, and the next offset is tried.
      if (crowding(api, dx, dy) > MAX_PLANT_NEIGHBOURS) continue
      // The **first** eligible water neighbour in this order is the one
      // candidate, and it gets one draw a tick — that is what makes "up first"
      // a preference rather than a rounding error. Falling through to the sides
      // on a *failed draw* would leave a submerged plant growing up barely a
      // third of the time, which is a blob again. The draw happens only once a
      // neighbour qualifies, as `applyReactions` does it, so the RNG stream
      // stays a function of the world rather than of how much air a plant
      // stands in.
      const grew = api.rand() < GROWTH_P
      if (grew) api.set(dx, dy, vine)
      // **Written every tick, not only when it changes.** A cell that should
      // keep acting must write or the chunk sleeps, and `Api` has no
      // `keepAwake` — writing `ra` marks the chunk dirty, so this is the only
      // lever a hook has. Settled water writes nothing at all, so without it a
      // plant in a still pond gets two or three draws and then never another.
      // The write stops as soon as the budget is spent or every candidate is
      // gone or crowded, so a finished plant still lets its chunk sleep — and
      // crowding only ever increases unless something else edits the world,
      // which wakes the chunk itself.
      api.ra = grew ? branches + 1 : branches
      return
    }
  }
}
