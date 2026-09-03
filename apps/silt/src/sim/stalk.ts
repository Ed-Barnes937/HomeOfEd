import type { Api } from './types.ts'

/**
 * The land plant (life spec §4.3) - the roster's third hook, and the second
 * grower/product pair after the seed bank's
 * ([ADR 0043](../../../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)).
 *
 * Four species make one plant, because one byte cannot both grow and expire:
 *
 * - **sprout 21** is what a seed germinates into on land (`seedBank.ts`). It
 *   raises a tip and is spent doing it.
 * - **stalk tip 22** is the grower. It owns `ra` as a travelling energy budget
 *   and declares no lifetime, so it can never die of old age - it climbs until
 *   the budget is spent and then blooms.
 * - **stalk 23** is the product left behind: inert, and it crumbles when its
 *   lifetime runs out. Without that a meadow silts up with immortal dead
 *   columns, which was the prototype's single most important finding.
 * - **flower 24** is the other product, and the plant's last cell.
 *
 * Nothing here consumes water. The biome was committed once, at germination
 * (spec §4.2), so a droplet resting on a land plant is just a droplet - which is
 * why a hook that reads only for *empty* air is the whole of "never grows into
 * water".
 */

/**
 * How tall a stalk grows, in cells: 6 to 10. The budget the sprout prepays is
 * this plus one - see `sproutBudget`.
 */
export const STALK_HEIGHT_MIN = 6
export const STALK_HEIGHT_JITTER = 4

/**
 * Per-tick chance the tip takes its next cell. A rate, not a split: 0.3 climbs
 * 6-10 cells in roughly 20-35 ticks, which is the pace that read as growing
 * rather than as snapping into place in the prototype.
 */
export const CLIMB_P = 0.3

/**
 * The species the sprout needs to know about, passed in rather than imported so
 * this module stays independent of the roster (and of a cycle through
 * `elements.ts`), exactly as `createGrowth` and `createSeedBank` take theirs.
 */
export interface SproutIds {
  empty: number
  /** The grower it raises, carrying its prepaid budget. */
  tip: number
  /** What the sprout itself becomes: the base of the stem. */
  stalk: number
}

/**
 * The travelling budget, in the byte the tip owns. It counts **height + 1**, so
 * `1` means spent and `0` keeps clear of the engine's "not seeded yet" - a tip
 * that reaches the world with no budget at all (painted, or restored from a
 * scene) blooms on the spot rather than climbing forever.
 */
function sproutBudget(api: Api): number {
  return STALK_HEIGHT_MIN + 1 + api.randInt(STALK_HEIGHT_JITTER + 1)
}

export function createSprout(ids: SproutIds): (api: Api) => void {
  return (api) => {
    // Roofed, under water, or against the world's edge: just wait. There is no
    // draw and no write on this path, so a sprout that cannot rise costs its
    // chunk nothing and is offered another look the tick its roof moves - the
    // same dormancy the buried seed under a meadow has.
    if (api.get(0, -1) !== ids.empty) return

    // **No probability, deliberately.** The prototype drew p 0.2 here, and it is
    // the one tuning value this pair declines: a failed draw would leave the
    // sprout needing to write a byte it does not otherwise use purely to keep
    // its own chunk awake, which is the disguised `ra` write spec §8 says to
    // stop and promote a real `keepAwake` for. The seedling beat it bought is
    // already paid for by germination's own slow draw upstream.
    //
    // The budget is prepaid into the cell being born, which is what `set`
    // carrying an `ra` exists for (life ticket 01): a hook cannot hand state to
    // a cell it creates any other way, and swapping into it and backfilling
    // would be movement inside a hook.
    api.set(0, -1, ids.tip, { ra: sproutBudget(api) })
    // The sprout is consumed by sprouting - it becomes the bottom cell of the
    // stem, so the column crumbles from the ground up like the rest of it.
    api.become(ids.stalk)
  }
}
