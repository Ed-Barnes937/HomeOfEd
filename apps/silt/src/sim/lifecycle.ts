import { emitInto } from './emit.ts'
import { EMPTY } from './elements.ts'
import type { Api, MovementApi } from './types.ts'
import type { ElementRegistry, ResolvedLifetime } from './registry.ts'

/**
 * What happens to a cell *after* its archetype has moved it. Neither of these
 * moves anything — that boundary is the whole point of the element model, and
 * running both after movement is what keeps the movement invariant safe.
 */

/**
 * Orthogonal contact only. A diagonal touch is a corner, and counting it would
 * double the neighbour checks on every cell in the world for a crust that looks
 * much the same.
 */
const CONTACTS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
]

/**
 * The first matching pair wins and both cells transmute — the cell is no longer
 * what it was, so nothing after this may keep running its element's code.
 * Neighbours are visited in a fixed order and the probability draw happens only
 * once a pair actually matches, so the RNG stream stays a function of the world.
 */
export function applyReactions(api: Api, registry: ElementRegistry): void {
  const self = api.get(0, 0)

  for (const [dx, dy] of CONTACTS) {
    const reaction = registry.reactionFor(self, api.get(dx, dy))
    if (!reaction) continue
    if (reaction.p < 1 && api.rand() >= reaction.p) continue

    api.set(dx, dy, reaction.bBecomes)
    api.become(reaction.aBecomes)
    return
  }
}

/**
 * Engine-managed decay in `ra` (spec §5.1) — an element with a `lifetime` never
 * writes the byte itself. Zero means "not seeded yet": a cell painted or spawned
 * mid-run starts its countdown on the first tick that sees it, jittered from the
 * sim PRNG so a batch spawned together does not expire in one frame. The
 * registry has already refused any roster whose seed could overflow the byte.
 *
 * Returns whether the cell survived. Writing `ra` also marks the chunk dirty,
 * which is what keeps a decaying cell awake in an otherwise settled corner.
 *
 * ## The coarse countdown (life ticket 01)
 *
 * `every: n` makes the byte count *draws* rather than ticks, so a 1200-tick
 * flower fits in it without widening the cell. `tick` is the world's generation
 * - the phase is **global, not per-cell**, because a cell has no second byte to
 * keep a phase in. Two consequences, both deliberate:
 *
 * - `ticks` and `jitter` are in **coarse units**. `ticks: 200, every: 6` is a
 *   1200-tick life and its jitter moves in steps of 6. Jitter is therefore the
 *   only thing that spreads a cohort's deaths out (the lockstep phase spreads
 *   nothing), which is also why a pre-grown scene wants `paint`'s `ra` seed.
 * - A cell placed mid-run waits out the remainder of the current coarse step
 *   before its first draw, so a life is accurate to within `every` ticks.
 *
 * `api` is the engine-internal `MovementApi` only for `keepAwake` - a skipped
 * tick genuinely has nothing to write, and `keepAwake` is kept off `Api` so no
 * element hook can reach it. Nothing here moves anything, as before.
 */
export function applyLifetime(api: MovementApi, lifetime: ResolvedLifetime, tick: number): boolean {
  let remaining = api.ra
  if (remaining === 0) {
    remaining = lifetime.ticks + (lifetime.jitter > 0 ? api.randInt(lifetime.jitter + 1) : 0)
    // A coarse countdown can leave below without decrementing, and an unwritten
    // seed would be re-drawn on every skipped tick - re-rolling the jitter and
    // eating the RNG stream with it. A tick-by-tick countdown always reaches the
    // write at the end, so it pays nothing for this.
    if (lifetime.every > 1) api.ra = remaining
  }

  if (lifetime.every > 1 && tick % lifetime.every !== 0) {
    // A skipped tick changes nothing, so nothing marks the chunk dirty and it
    // would sleep with the cell frozen mid-life. Same judgement the `move`
    // probabilities make in the kernels: declining to act is not being done.
    api.keepAwake()
    return true
  }

  remaining--
  if (remaining <= 0) {
    // **The death drop** (life ticket 04), and the reason it lives here rather
    // than in the element: `onTick` is gated on the cell surviving this call, so
    // a product has no way at all to act on the tick it dies. `becomes` alone
    // can only rewrite the one cell, and a withering flower leaves a seed *and*
    // throws petals clear of itself. Emitted before `become`, so the cell being
    // scattered from is still the parent and its own slot is never a candidate.
    const { emits } = lifetime
    if (emits) {
      emitInto(api, EMPTY, emits.species, emits.min + api.randInt(emits.max - emits.min + 1))
    }
    api.become(lifetime.becomes)
    return false
  }

  api.ra = remaining
  return true
}
