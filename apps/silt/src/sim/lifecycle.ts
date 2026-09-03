import { EMPTY } from './elements.ts'
import type { Api } from './types.ts'
import type { ElementRegistry, ResolvedLifetime } from './registry.ts'
import type { WitnessTable } from './witness.ts'

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
 *
 * The pair is handed to the witness recorder as it applies - one of the three
 * discovery sites (discovery-tree spec §3). Recording draws no randomness and
 * writes no cell, so nothing above changes because of it.
 */
export function applyReactions(api: Api, registry: ElementRegistry, witness: WitnessTable): void {
  const self = api.get(0, 0)

  for (const [dx, dy] of CONTACTS) {
    const other = api.get(dx, dy)
    const reaction = registry.reactionFor(self, other)
    if (!reaction) continue
    if (reaction.p < 1 && api.rand() >= reaction.p) continue

    api.set(dx, dy, reaction.bBecomes)
    api.become(reaction.aBecomes)
    witness.reaction(self, other)
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
 * `species` is what the cell still is - the scan has already checked that a
 * reaction did not transmute it - and is passed rather than re-read so the
 * witness recorder costs nothing beyond its own flag. A decay **with a product**
 * is a discovery; a fade is not an interaction at all (spec §1), so smoke
 * expiring records nothing.
 */
export function applyLifetime(
  api: Api,
  lifetime: ResolvedLifetime,
  species: number,
  witness: WitnessTable,
): boolean {
  let remaining = api.ra
  if (remaining === 0) {
    remaining = lifetime.ticks + (lifetime.jitter > 0 ? api.randInt(lifetime.jitter + 1) : 0)
  }

  remaining--
  if (remaining <= 0) {
    if (lifetime.becomes !== EMPTY) witness.decay(species)
    api.become(lifetime.becomes)
    return false
  }

  api.ra = remaining
  return true
}
