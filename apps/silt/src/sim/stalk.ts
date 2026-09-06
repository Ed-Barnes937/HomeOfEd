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
 * The meadow's numbers, and the defaults every option below falls back to. They
 * are constants rather than literals in `elements.ts` because they are the plant
 * the whole file is written about; a second plant passes its own
 * ([the cactus spec](../../../../.scratch/silt-cactus/spec.md) §4).
 *
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
 * Chance the terminal transition ends in the flower rather than in the cap
 * species. **1 for the meadow, and that is load-bearing**: the tip's whole life
 * is one flower, so there is nothing to decide and `createTip` spends no draw at
 * all (see the terminal branch). The `Rng` is one stream shared by the world, so
 * a draw spent here would shift every draw downstream of it.
 */
export const FLOWER_P = 1

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
 * How tall this plant grows. Options rather than constants because the same two
 * hooks raise the desert's column (cactus spec §4) - a saguaro is 10-16 cells
 * where the meadow's stalk is 6-10, and nothing else about being spent into a
 * stem differs. Omit either and the meadow's number stands.
 */
export interface SproutOptions {
  /** Shortest column, in cells. */
  heightMin?: number
  /** How much taller than that a column may draw, inclusive. */
  heightJitter?: number
}

/** What the tip needs to know about: the cell it makes, and the two it becomes. */
export interface TipIds {
  empty: number
  /** Itself, one cell up, carrying the rest of the budget. */
  tip: number
  /** What it leaves behind, one cell of stem at a time. */
  stalk: number
  /** What it becomes when the budget runs out - or when it is boxed in. */
  flower: number
  /**
   * The other thing it may become at that same moment: the plant that finished
   * without crowning. Optional, and it defaults to the flower - a roster naming
   * no second product has only one ending, which is exactly the meadow.
   */
  cap?: number
}

/** How this plant climbs, and how it ends. See `SproutOptions` for the pair's why. */
export interface TipOptions {
  /** Per-tick chance of taking the next cell. Defaults to `CLIMB_P`. */
  climbP?: number
  /**
   * Chance the ending is the flower rather than `ids.cap`. Defaults to
   * `FLOWER_P` (1), which costs no draw.
   */
  flowerP?: number
}

/**
 * The travelling budget, in the byte the tip owns. It counts **height + 1**, so
 * `1` means spent and `0` keeps clear of the engine's "not seeded yet" - a tip
 * that reaches the world with no budget at all (painted, or restored from a
 * scene) blooms on the spot rather than climbing forever.
 */
function sproutBudget(api: Api, heightMin: number, heightJitter: number): number {
  return heightMin + 1 + api.randInt(heightJitter + 1)
}

export function createSprout(ids: SproutIds, opts: SproutOptions = {}): (api: Api) => void {
  // Resolved once, at build time: the defaults are a property of *this plant*,
  // not a decision to re-make on every cell of it every tick.
  const heightMin = opts.heightMin ?? STALK_HEIGHT_MIN
  const heightJitter = opts.heightJitter ?? STALK_HEIGHT_JITTER

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
    api.set(0, -1, ids.tip, { ra: sproutBudget(api, heightMin, heightJitter) })
    // Reported before `become`: the witness reads the sprout off the cursor,
    // and the next line spends it into stem (discovery ticket 07).
    api.witnessRaise()
    // The sprout is consumed by sprouting - it becomes the bottom cell of the
    // stem, so the column crumbles from the ground up like the rest of it.
    api.become(ids.stalk)
  }
}

/**
 * **The grower** (spec §4.3), and the reason `set` had to learn to carry a byte
 * (life ticket 01): a plant that grows *and* dies cannot be one species, so the
 * tip climbs and the stem it leaves behind is what expires.
 *
 * The budget travels with the tip rather than being counted from the ground up.
 * The alternative - a cell that looks down its own stem to work out how tall it
 * is - reads further than `CHUNK_MARGIN` allows on anything but the shortest
 * plant, and the one after that (swap into the cell above and backfill stem)
 * is movement inside a hook, which the element model forbids (spec §2.2).
 */
export function createTip(ids: TipIds, opts: TipOptions = {}): (api: Api) => void {
  // Resolved once, at build time - as in `createSprout`, and for the same
  // reason. `cap` is one of them: an unnamed cap *is* the flower, so the
  // terminal branch below has a species either way and never a `?? ids.flower`
  // of its own.
  const climbP = opts.climbP ?? CLIMB_P
  const flowerP = opts.flowerP ?? FLOWER_P
  const cap = ids.cap ?? ids.flower

  return (api) => {
    const budget = api.ra

    // **Terminate, never spin.** Two ways to be finished: the budget is spent,
    // or the plant is boxed in - roofed by anything at all, the world's ceiling
    // included. Waiting out a roof would mean writing every tick for as long as
    // the tip is trapped, on the chance the roof moves; blooming early costs the
    // plant the rest of its height and nothing else.
    if (budget <= 1 || api.get(0, -1) !== ids.empty) {
      // **One draw decides the product, and only when there is a product to
      // decide.** `flowerP >= 1` short-circuits before `rand()` is ever reached:
      // the `Rng` is a single stream, so a draw taken where the answer is
      // already known shifts every draw after it in the world and moves tests
      // that have nothing to do with plants. This is also the only place the two
      // endings differ from each other in no way at all - a plant that was boxed
      // in gets the same odds as one that ran out of budget, because the draw is
      // about what the plant *is*, not about how it stopped.
      const product = flowerP >= 1 || api.rand() < flowerP ? ids.flower : cap
      // Both ends are the one `bloom:tip` entry - a bloom is a bloom, however it
      // was forced and whichever product it picked - reported before `become`
      // spends the tip (ticket 07). It is cursor-read, so a second plant's
      // grower keys its own entry with no argument here.
      api.witnessBloom()
      api.become(product)
      return
    }

    if (api.rand() < climbP) {
      // The budget is handed on, and this cell is inert stem from here.
      api.set(0, -1, ids.tip, { ra: budget - 1 })
      api.become(ids.stalk)
      return
    }

    // **The keep-awake write, on the missed draw only.** A cell that should keep
    // acting must write or its chunk sleeps and the plant freezes mid-air, and
    // `Api` has no `keepAwake` - so the tip rewrites the byte it already owns,
    // exactly as `growth.ts` rewrites its branch count. It must not happen on
    // the climbing branch: that cell is stalk by then, and the stem's `lifetime`
    // owns `ra` (ADR 0043) - a write there would pre-spend its countdown.
    //
    // Self-terminating, as a hook has to be: the writes stop the tick the tip
    // blooms, and a bloomed cell has no candidate left to write for.
    api.ra = budget
  }
}
