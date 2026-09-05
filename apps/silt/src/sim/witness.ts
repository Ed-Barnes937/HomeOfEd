import type { ElementRegistry } from './registry.ts'

/**
 * The discovery recorder (discovery-tree spec §3, §4): which transmutations the
 * sim has actually performed in front of the player. It lives **in the sim
 * core**, not in the worker glue, so the worker and the main-thread fallback
 * both get it for free.
 *
 * Perf is the whole design. Reactions fire on the hot path of a 60/120fps
 * simulation, so an event costs one index computation, one load and one branch;
 * only the first witness of an interaction - a few dozen of them, ever - stores
 * a flag and allocates anything. Nothing here draws from the `Rng` or touches a cell,
 * so the sim behaves identically whether or not anybody is watching.
 *
 * The tables are indexed by species id (and by a species *pair* packed into one
 * integer), never by string. Names are only reached for at the reporting edge,
 * where the event has already proved itself rare.
 */

/**
 * One interaction seen for the first time, tagged by which kind of site fired
 * (the tags match field notes' `EdgeKind`). Named, not numbered: names
 * are the identity the scene codec and the field-notes edge keys already share,
 * and by the time an event exists a name lookup no longer costs anything.
 *
 * `features/fieldNotes` turns these into canonical edge keys; the sim
 * deliberately does not know that vocabulary.
 */
export type WitnessEvent =
  /** The pair that reacted, sorted by name so the scan order cannot show through. */
  | { kind: 'react'; a: string; b: string }
  /** The element that expired, leaving a product behind. */
  | { kind: 'decay'; a: string }
  /** The plant that grew into a neighbour. */
  | { kind: 'grow'; a: string }
  /** A buried seed germinated - named for the *plant that came up*, because one site decides two entries. */
  | { kind: 'germinate'; a: string }
  /** The sprout that raised its tip and became the base of the stem. */
  | { kind: 'raise'; a: string }
  /** The tip that bloomed - budget spent, or boxed in; the two ends are one entry. */
  | { kind: 'bloom'; a: string }

/** Every species id is a byte, so every table keyed by one is a flat 256 slots. */
const SPECIES_SLOTS = 256
/** …and an unordered pair of them packs into one integer, as the registry's does. */
const PAIR_SLOTS = SPECIES_SLOTS * SPECIES_SLOTS

/** Shared, so a tick with nothing to report allocates nothing at all. */
const NOTHING: readonly WitnessEvent[] = []

export class WitnessTable {
  readonly #registry: ElementRegistry
  readonly #reactions = new Uint8Array(PAIR_SLOTS)
  readonly #decays = new Uint8Array(SPECIES_SLOTS)
  readonly #growth = new Uint8Array(SPECIES_SLOTS)
  readonly #germinations = new Uint8Array(SPECIES_SLOTS)
  readonly #raises = new Uint8Array(SPECIES_SLOTS)
  readonly #blooms = new Uint8Array(SPECIES_SLOTS)
  #pending: WitnessEvent[] = []

  constructor(registry: ElementRegistry) {
    this.#registry = registry
  }

  /**
   * A reaction pair applied. Unordered: the scan reaches one of the two cells
   * first and either way it is the same interaction, so the ids are sorted into
   * the key rather than recorded twice.
   */
  reaction(a: number, b: number): void {
    const slot = a < b ? (a << 8) | b : (b << 8) | a
    if (this.#reactions[slot] === 1) return
    this.#reactions[slot] = 1

    const first = this.#name(a)
    const second = this.#name(b)
    if (first === undefined || second === undefined) return
    this.#pending.push(
      first <= second
        ? { kind: 'react', a: first, b: second }
        : { kind: 'react', a: second, b: first },
    )
  }

  /**
   * A decay that left a product. A fade (`becomes: null`) transmutes into
   * nothing, so it is not an interaction and never reaches here (spec §1).
   */
  decay(from: number): void {
    if (this.#decays[from] === 1) return
    this.#decays[from] = 1

    const name = this.#name(from)
    if (name !== undefined) this.#pending.push({ kind: 'decay', a: name })
  }

  /** The growth hook grew a cell. Named for the plant that did the growing. */
  growth(grower: number): void {
    if (this.#growth[grower] === 1) return
    this.#growth[grower] = 1

    const name = this.#name(grower)
    if (name !== undefined) this.#pending.push({ kind: 'grow', a: name })
  }

  /**
   * The seed bank germinated. Keyed by the *product* rather than the seed,
   * because germination is one site with two entries (discovery ticket 07):
   * which plant came up is the biome decision, and it is what the player
   * witnessed.
   */
  germination(product: number): void {
    if (this.#germinations[product] === 1) return
    this.#germinations[product] = 1

    const name = this.#name(product)
    if (name !== undefined) this.#pending.push({ kind: 'germinate', a: name })
  }

  /** A sprout raised its tip. Named for the sprout - the cell that transmuted. */
  raise(from: number): void {
    if (this.#raises[from] === 1) return
    this.#raises[from] = 1

    const name = this.#name(from)
    if (name !== undefined) this.#pending.push({ kind: 'raise', a: name })
  }

  /** A tip bloomed. Named for the tip; how it ended (budget or roof) is not part of the entry. */
  bloom(from: number): void {
    if (this.#blooms[from] === 1) return
    this.#blooms[from] = 1

    const name = this.#name(from)
    if (name !== undefined) this.#pending.push({ kind: 'bloom', a: name })
  }

  /**
   * Firsts since the last drain, and hand them over: what has been reported is
   * the caller's to keep. Empty on almost every tick, which is why the empty
   * answer is a shared constant.
   */
  drain(): readonly WitnessEvent[] {
    if (this.#pending.length === 0) return NOTHING
    const events = this.#pending
    this.#pending = []
    return events
  }

  /**
   * The reporting edge, reached once per interaction in a session and never on
   * a tick that witnessed nothing new. A species nothing is registered under
   * cannot be named, so it is dropped rather than reported as `undefined` - its
   * flag is set either way, so it is dropped once.
   */
  #name(id: number): string | undefined {
    return this.#registry.get(id)?.name
  }
}
