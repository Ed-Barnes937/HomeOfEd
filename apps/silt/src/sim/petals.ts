import { emitInto } from './emit.ts'
import type { Api } from './types.ts'

/**
 * Petals (life spec §4.4) - the roster's fifth hook, and the smallest of them.
 *
 * The **death drop** is not here: a cell cannot act on the tick its lifetime
 * expires, so the flower's `lifetime.emits` does it and the engine scatters the
 * brood (`lifecycle.ts`, ADR 0043 §4). What is left for a hook is the
 * *shedding*, which happens while the flower is alive and so is an ordinary
 * per-tick draw.
 *
 * Everything else a petal does is data: it is a slow powder that floats, it
 * expires as garnish, and the two strikes that turn one into a seed are reaction
 * rows in `elements.ts`.
 */

/**
 * Per-tick chance a living flower lets a petal go. A rate rather than a share,
 * as every `p` here is: a flower lives 600-1200 ticks, so 0.005 means three to
 * six shed petals over a life rather than one in two hundred flowers shedding.
 * Which is the point - the drift is meant to be continuous, not an event.
 */
export const SHED_P = 0.005

/**
 * What the hook needs to know about, passed in rather than imported so this
 * module stays independent of the roster (and of a cycle through `elements.ts`),
 * exactly as `createGrowth`, `createSeedBank` and `createSprout` take theirs.
 */
export interface ShedIds {
  empty: number
  petal: number
}

export function createShed(ids: ShedIds): (api: Api) => void {
  return (api) => {
    if (api.rand() >= SHED_P) return
    // **No keep-awake write on the missed draw**, unlike the growers'. The
    // flower declares a `lifetime`, so the engine is already writing its
    // countdown byte (or calling `keepAwake` on a coarse skip) every tick of its
    // life - the chunk under a blooming meadow cannot sleep while a flower
    // stands in it. This is the one hook that needs nothing of its own.
    //
    // A crowded flower sheds nothing rather than pushing a neighbour aside, so
    // the drift thins out on its own where a meadow is dense (`emit.ts`).
    emitInto(api, ids.empty, ids.petal, 1)
  }
}
