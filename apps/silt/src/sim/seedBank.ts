import type { Api } from './types.ts'

/**
 * The seed bank (life spec §4.1-4.2) - the roster's second `onTick`, and the one
 * place a plant's biome is decided.
 *
 * A seed that reaches wet soil sinks into it (the `seed + mud` row in
 * `elements.ts`) and waits there, dormant, until something opens the sky above
 * it. Two things fall out of that for free. Fire never reaches the bank - it is
 * not flammable and it lives *under* the surface - so a burnt meadow still holds
 * every seed it banked and comes back in one generation rather than twenty. And
 * reproduction becomes density dependent with no rule about density: a full
 * meadow roofs its own soil, so its bank sleeps, while scorched open ground
 * buries and germinates readily.
 *
 * Burial *replaced* instant germination rather than joining it: one reaction row
 * per pair and `p` is a rate, never a split (spec §2.4), so `seed + mud` cannot
 * both sprout at p 1 and bury at p 0.1. All germination therefore routes through
 * here. See [ADR 0043](../../../../docs/adr/0043-silt-growers-and-products-split-the-byte.md).
 */

/**
 * Ticks of *unbroken* submersion before a buried seed will commit aquatic. Two
 * seconds of standing water at 60 tps: a shower cannot fake it and a flood
 * cannot avoid it.
 */
export const SOAK_TO_DROWN = 120

/** The soak counter is one byte, so this is as long as a seed can remember. */
export const MAX_SOAK = 255

/**
 * Cells of water that have to stand over a germination for it to commit aquatic.
 *
 * **Two, and that is the whole of `CHUNK_MARGIN`** - the same slack
 * `growth.ts`'s crowding check spends, and for the same reason: a write anywhere
 * wakes every chunk within two cells of it, so a bank two cells under a pool is
 * woken when the pool drains, but there is no slack left. A depth-3 rule needs
 * the margin raised in the same change.
 */
export const SOAK_DEPTH = 2

/**
 * Per-tick germination probability once the sky is open. The prototype drew
 * 0.005 once every four ticks - the coarse form `lifetime.every` uses, for the
 * same reason it exists: it is the cheap way to spell a slow rate. A hook cannot
 * see the world's tick (only the engine's countdown can), so the pair collapses
 * into one draw a tick at the same effective rate, and a buried seed under open
 * sky waits ~800 ticks.
 *
 * This is the single knob that moved the standing population most, so tuning it
 * against the ~20-crown target is ticket 06's job, not this one's.
 */
export const GERMINATE_P = 0.005 / 4

/**
 * The species the hook needs to know about, passed in rather than imported so
 * this module stays independent of the roster (and of a cycle through
 * `elements.ts`), exactly as `createGrowth` takes its three.
 */
export interface SeedBankIds {
  empty: number
  water: number
  /** The aquatic commitment: moss, whose existing rules grow vine into water. */
  moss: number
  /**
   * The land commitment, or `null` while the species does not exist yet. Ticket
   * 03 pins sprout 21 and passes it here; until then an unroofed seed on dry
   * ground stays banked, which is a paused meadow rather than a wrong one.
   */
  sprout: number | null
  /** What the soil cell is refunded as - dirt, never mud. See below. */
  dirt: number
}

export function createSeedBank(ids: SeedBankIds): (api: Api) => void {
  /**
   * Whether `SOAK_DEPTH` cells of water stand over this one. Reads straight up
   * and no further - see `SOAK_DEPTH` on why that bound is not arbitrary.
   */
  const deep = (api: Api): boolean => {
    for (let up = 1; up <= SOAK_DEPTH; up++) {
      if (api.get(0, -up) !== ids.water) return false
    }
    return true
  }

  return (api) => {
    const above = api.get(0, -1)
    const submerged = above === ids.water

    // **`ra` is the engine's `lifetime` byte** - see the byte-ownership rule on
    // `Api`. A buried seed declares no lifetime, so nothing is claiming the byte
    // and this hook keeps its soak counter there. That is the third conditional
    // claim on `ra`, after growth's branch count and the liquid opinion field,
    // and the reason the seed splits into a falling grain and a buried one at
    // all (ADR 0043): giving the buried seed a lifetime would hand the byte back
    // to the engine and the biome test would silently read a countdown.
    let soak = api.ra
    if (submerged) {
      // Saturating rather than wrapping: the window is 120 and the byte holds
      // 255, so a wrap would un-drown a seed that has been under a lake for
      // good.
      if (soak < MAX_SOAK) soak += 1
    } else {
      // Any break in the submersion resets it, a roof included. *Continuous*
      // wetness is what makes rain and a flood differ in kind rather than in
      // degree: a one-shot look above was flipped aquatic by a droplet resting
      // three ticks, and depth alone by two droplets landing in one column.
      soak = 0
    }

    if (!submerged && above !== ids.empty) {
      // **Dormant, and silent.** Roofed by soil, plant, stone or the world's
      // edge: there is nothing above to germinate into, so the hook writes
      // nothing and the chunk sleeps under a crowded meadow (spec §2.7). A write
      // anywhere wakes every chunk within two cells of it, so the seed is
      // offered a draw again on the tick its roof burns or is dug out. The one
      // write on this path is clearing a stale soak, which happens once and then
      // stops - self-terminating, as a hook has to be.
      if (api.ra !== 0) api.ra = 0
      return
    }

    // **Written every tick, not only when it changes**, exactly as `growth.ts`
    // writes its branch count and for the same reason: a hook cannot keep its
    // own cell awake, and both settled water and open air write nothing at all.
    // Without this a buried seed gets a draw or two and then sleeps for good
    // under a still pond. It stops the moment the seed germinates or is roofed.
    api.ra = soak

    // **The one biome decision, made once and never revisited** (spec §4.2).
    // Before the commitment moved here, an element looked up every tick and a
    // single droplet resting against an established plant flipped it to vine;
    // now the seed looks up once and the two never swap. Flooding still turns a
    // meadow to marsh, but through the *next* generation, which is the part
    // worth keeping.
    //
    // Aquatic needs depth AND soak, because either test alone leaks - see the
    // reset above. Land needs only open air: a land plant consumes no water, so
    // a splash on one is just a splash.
    const becomes = submerged ? (soak >= SOAK_TO_DROWN && deep(api) ? ids.moss : null) : ids.sprout
    if (becomes === null) return
    if (api.rand() >= GERMINATE_P) return

    api.set(0, -1, becomes)
    // **The soil cell is refunded as dirt, not mud**: the plant drank the
    // moisture it grew out of (spec ruling 2). So the bed's ledger is
    // bank + mud + dirt, and it is burial costing a soil cell against
    // germination giving one back that caps the bank - with no rule about it.
    api.become(ids.dirt)
  }
}
