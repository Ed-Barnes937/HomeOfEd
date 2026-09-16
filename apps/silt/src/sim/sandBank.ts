import type { Api } from './types.ts'

/**
 * The sand bank (cactus spec §4) - the desert's half of the biome decision the
 * mud bank already embodies, and deliberately the simpler half.
 *
 * A seed that lands on sand used to rot where it lay: sand has no water row, so
 * there was no burial route and the bed was a dead end. The `seed + sand` row in
 * `elements.ts` now beds it as `duned`, and this hook is what that species
 * carries - it waits under its dune until something opens the sky, then raises a
 * `nub` and lets the cactus take it from there.
 *
 * **Not a third branch inside `seedBank.ts`.** The mud bank's soak counter,
 * depth test and biome fork all exist to tell standing water from a shower; a
 * dune has no such question to answer, because the biome was already committed
 * at burial - a seed blown onto sand is a cactus and a seed rolled onto mud is a
 * meadow plant, and neither is ever revisited. Folding this in would have made
 * the mud bank's one decision into two.
 *
 * **The bank owns no byte.** `duned` declares no `lifetime`, so `ra` is free -
 * but there is nothing this hook needs to remember from one tick to the next, so
 * it claims nothing. That is what makes it the second legitimate customer of the
 * public `api.keepAwake()`, after the evaporation hook that promoted it
 * ([ADR 0044](../../../../docs/adr/0044-silt-thin-film-evaporation.md) §3): a
 * hook that must go on being offered a draw has to write *something*, and the
 * three growers before it each disguised that as a rewrite of a byte they
 * already owned. Inventing a counter here purely to have something to write is
 * the exact move that rule exists to stop.
 */

/**
 * Per-tick germination probability once the sky above the dune is open. Spelled
 * in the coarse form `seedBank.ts`'s is - a rate drawn one tick in four,
 * collapsed into one draw a tick at the same effective rate, because a hook
 * cannot see the world's tick.
 *
 * **Half the mud bank's, and that is the point**: a desert establishes slowly.
 * The mud bank was tuned for establishment speed on a bed whose size caps the
 * meadow (life ticket 06); here the cap is different in kind - nothing is drunk,
 * so a dune can germinate over and over and what limits the desert is how few
 * seeds reach it (burial p 0.03, against mud's 0.1, against a loose seed's rot
 * clock). Cactus spec §5 has this as a starting point measured in ticket 04.
 */
export const GERMINATE_P = 0.004 / 4

/**
 * The species the hook needs to know about, passed in rather than imported so
 * this module stays independent of the roster (and of a cycle through
 * `elements.ts`), exactly as `createGrowth`, `createSeedBank`, `createSprout`
 * and `createEvaporation` take theirs.
 */
export interface SandBankIds {
  empty: number
  /** The seedling raised into the open air - spent raising the apex. */
  nub: number
  /** What the bed cell is refunded as. See the refund below. */
  sand: number
}

export function createSandBank(ids: SandBankIds): (api: Api) => void {
  return (api) => {
    // **Dormant, and silent** (cactus spec §4). Roofed by *anything* - another
    // grain, a plant, stone, standing water, or the world's edge - there is
    // nothing above to germinate into, so the hook writes nothing, wakes
    // nothing, and the chunk sleeps under a buried dune. A write anywhere wakes
    // every chunk within `CHUNK_MARGIN` of it, so the bank is offered a draw
    // again on the tick its roof is dug out, drains or blows away.
    //
    // **Water roofs it too**, which is where this bank and the mud one part
    // company: there, standing water is the aquatic branch and the seed counts
    // its soak; here it is just weather over a committed bed. The spec is
    // explicit that nothing about a cactus is decided by water after burial.
    //
    // Silent from the first tick rather than after one clearing write, because
    // there is no stale state to clear - the bank keeps nothing in `ra`.
    if (api.get(0, -1) !== ids.empty) return

    // **The keep-awake, on the open-sky path.** Settled sand writes nothing at
    // all, so a dune whose draw missed would sleep and never be offered
    // another - and unlike `growth.ts`, `seedBank.ts` and `stalk.ts` this hook
    // has no byte of its own to disguise the wake in. The judgement `Api` asks
    // for is whether *this* cell still has business next tick, and an unroofed
    // dune plainly does: it is drawing for germination every tick until it
    // germinates or is roofed again. Self-terminating on both of those.
    api.keepAwake()

    if (api.rand() >= GERMINATE_P) return

    api.set(0, -1, ids.nub)
    // One site, one entry (discovery ticket 07): unlike the mud bank there is no
    // biome decision here to pick between two products, but the surface takes
    // the product either way, so the bank names what it just raised. A flag and
    // nothing more - no draw, no cell - so the determinism suite holds with the
    // recorder in place.
    api.witnessGermination(ids.nub)
    // **The bed cell is refunded as sand: nothing is drunk.** The mud bank
    // refunds *dirt* because the plant drank the moisture it grew out of, and
    // that refund is what caps the meadow at one plant per cell of wet soil.
    // The desert has no such ledger - a cactus is a water tank it filled from
    // somewhere else entirely - so the dune is handed straight back and the cap
    // is seed scarcity instead: how rarely a seed survives long enough to bury
    // (cactus spec §3, burial p 0.03).
    api.become(ids.sand)
  }
}
