import type { Api } from './types.ts'

/**
 * Scattering a brood into the free cells around one cell (life ticket 04) -
 * shared by the engine's `lifetime.emits` (`lifecycle.ts`) and by the flower's
 * shedding hook (`petals.ts`), which are the same act at two different moments.
 *
 * It moves nothing and displaces nothing: a cell that is not empty is simply
 * skipped, so a boxed-in flower sheds nothing rather than pushing its way out.
 * That keeps it safe to call from a hook, where movement is forbidden (life spec
 * §2.2), and safe to call from the engine after the cell has already been
 * counted this tick.
 */

/**
 * The eight neighbours, in the order a brood fills them. The walk starts at a
 * random index and wraps, so a brood smaller than eight is not biased towards
 * one corner.
 *
 * **All eight, where the prototype used seven** - it left out the cell directly
 * below so a dying flower's seed had somewhere to fall. That exclusion measures
 * as nothing here: the cell below a standing flower is its own stem, and the
 * seed the flower becomes is denser than a petal (40 to 10), so it falls through
 * one anyway. Eight is the rule that needs no exception written down.
 */
export const EMIT_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/**
 * Puts up to `want` cells of `species` into the empty neighbours of the cursor.
 * Returns how many landed - fewer than asked for when the cell is crowded, which
 * is the density dependence a meadow gets for free.
 */
export function emitInto(api: Api, empty: number, species: number, want: number): number {
  const start = api.randInt(EMIT_OFFSETS.length)
  let placed = 0
  for (let k = 0; k < EMIT_OFFSETS.length && placed < want; k++) {
    const [dx, dy] = EMIT_OFFSETS[(start + k) % EMIT_OFFSETS.length]!
    if (api.get(dx, dy) !== empty) continue
    api.set(dx, dy, species)
    placed++
  }
  return placed
}
