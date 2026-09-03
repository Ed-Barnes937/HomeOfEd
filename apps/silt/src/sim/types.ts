/**
 * The element model (spec §5.2): **archetypes own movement, hooks own
 * transmutation**. Elements are pure config — an element that needs new *motion*
 * is a bug report against the archetype set, not a new hook.
 */

/**
 * How far a fluid may travel sideways in one tick when it can go no lower, and
 * the per-step probability that it moves at all. `move` is what makes lava a
 * "slow liquid" — a probability, never a velocity field.
 */
export interface Fluid {
  density: number
  dispersion: number
  move?: number
}

/**
 * Engine-owned, **closed** set of four motion kernels (spec §5.2). Density
 * orders displacement; a gas has a negative density, which is what makes
 * everything else sink past it rather than the gas push its way up.
 *
 * `applyArchetype` switches exhaustively, so a fifth variant cannot be added
 * here without its kernel landing in the same change.
 */
export type Archetype =
  | { kind: 'static' }
  | { kind: 'powder'; density: number; slide: number }
  | ({ kind: 'liquid' } & Fluid)
  | ({ kind: 'gas' } & Fluid)

/**
 * Engine-managed decay. Countdown lives in `ra` — see the byte-ownership rule
 * on `Api`. The engine seeds it on the cell's first tick and decrements it
 * every tick after, so an element never writes it itself.
 */
export interface Lifetime {
  ticks: number
  /** Random spread added to `ticks`, in ticks. */
  jitter?: number
  /** Element name to turn into on expiry, or `null` to vanish. */
  becomes: string | null
}

/**
 * A tag-keyed pair rule: `a` and `b` are element names *or* tags, which is what
 * keeps the table from going O(n²). Rules live here, never in element code —
 * water + lava → obsidian is one row of data.
 *
 * The table is symmetric: the scan reaches one of the two cells first, and
 * either way the same pair matches with the `becomes` sides swapped to suit.
 * Where two rows match a pair, the earlier row wins.
 */
export interface ReactionRow {
  a: string
  b: string
  /** Per-contact probability, in (0, 1]. */
  p: number
  /** Element name the `a` side becomes, or `null` to clear the cell. */
  aBecomes: string | null
  bBecomes: string | null
  /** Only matches when *both* cells are at or below this hardness. */
  maxHardness?: number
}

export interface ElementDef {
  /**
   * Pinned explicitly and never renumbered — species bytes go straight into
   * localStorage scenes. 0 (empty) and 255 (wall) are reserved by the engine.
   */
  id: number
  /** One word; the scene format remaps species bytes by this name. */
  name: string
  /**
   * One to `VARIANT_SLOTS` (8) shades of `#rrggbb`; each cell is drawn in one of
   * them, picked by its `rb` byte, which is what keeps a mass of one element
   * from reading as a slab. `colours[0]` is the base — the rail swatch shows it,
   * so it must be the colour the element is *recognised* by. Declaring a count
   * that divides 8 gets the shades in equal shares. The registry refuses a
   * ninth, since no `rb` could reach it. See
   * [ADR 0040](../../../../docs/adr/0040-silt-colour-variants-in-rb.md).
   */
  colours: readonly string[]
  tags: readonly string[]
  archetype: Archetype
  hardness?: number
  lifetime?: Lifetime
  /**
   * At most one hook, run strictly *after* archetype movement so it can never
   * corrupt the movement invariant — and after reactions and decay, so it never
   * runs on a cell that is no longer this element.
   */
  onTick?: (api: Api) => void
}

/**
 * The element-facing surface. **Chunk-relative only**: every coordinate is a
 * `(dx, dy)` offset from the cell being processed, never an absolute position,
 * so the same hook is correct under the chunked iteration arriving in ticket 05.
 *
 * Out-of-bounds reads return the WALL sentinel, never `undefined` — no element
 * ever branches on edges. Out-of-bounds writes are dropped.
 *
 * Byte ownership (spec §5.1): the engine's `lifetime` feature owns `ra`, colour
 * variant owns `rb`. A hook must not scribble on a byte an engine feature owns.
 */
export interface Api {
  /** Species id at the offset; WALL out of bounds. */
  get(dx: number, dy: number): number
  /**
   * Overwrite the cell at the offset. Its `ra` is cleared and its `rb` is given
   * a fresh colour variant — the cell is newly born, and a transmutation that
   * left it at variant 0 would flatten the product into a slab (ADR 0040).
   */
  set(dx: number, dy: number, species: number): void
  /**
   * Exchange this cell with the one at the offset. The cursor follows, so
   * subsequent calls stay relative to the element's new home.
   */
  swap(dx: number, dy: number): void
  /** Transmute this cell in place, keeping its position. Rewrites `ra`/`rb` as `set` does. */
  become(species: number): void
  has(dx: number, dy: number, tag: string): boolean
  /** Scratch byte of this cell — owned by `lifetime`. */
  get ra(): number
  set ra(value: number)
  /**
   * Scratch byte of this cell — owned by colour variant, seeded by the engine
   * whenever a cell is born and never written by an element.
   */
  get rb(): number
  set rb(value: number)
  rand(): number
  randInt(maxExclusive: number): number
  /**
   * Report that this cell just grew into a neighbour - one of the three
   * discovery sites (discovery-tree spec §3), and the only one the engine
   * cannot see for itself: a reaction and a decay are engine business, a hook's
   * transmutation is not. The cell's own species is the grower, so the hook
   * says *that it grew*, not what it is.
   *
   * Records nothing but a flag: no cell is touched and no randomness is drawn,
   * so calling it can never change what the world does. It is the one thing on
   * this surface that is not simulation - an element with nothing to declare
   * simply never calls it.
   */
  witnessGrowth(): void
}

/**
 * Engine-internal extension used by the motion kernels. `tryMove` is where the
 * density ordering lives, so kernels never touch the registry themselves.
 */
export interface MovementApi extends Api {
  /** Move into the offset if it is empty or holds something less dense. */
  tryMove(dx: number, dy: number): boolean
  /** Whether `tryMove` to the offset would succeed, without taking the step. */
  canMove(dx: number, dy: number): boolean
  /**
   * A *neighbour's* scratch byte. `Api.ra` is cursor-only, and the liquid
   * kernel's opinion contagion is the one thing in the engine that has to reach
   * across a cell boundary to write it. Kept off `Api` deliberately: an element
   * hook scribbling on another cell's engine-owned byte is the failure mode the
   * byte-ownership rule exists to prevent.
   *
   * Reads out of bounds answer 0 and writes out of bounds are dropped, as
   * everywhere else. A write marks the neighbour's chunk dirty.
   */
  raAt(dx: number, dy: number): number
  setRaAt(dx: number, dy: number, value: number): void
  /**
   * Keep this cell's chunk awake for the next tick without changing anything.
   * A cell that *could* move and declined — a `move` probability that did not
   * come up — writes nothing, and the chunk would otherwise sleep with the cell
   * still in mid-air.
   */
  keepAwake(): void
  /**
   * Whether the last successful `tryMove` merely *queued* a cross-chunk move
   * rather than committing it. The cursor did not follow, so a kernel that
   * takes several steps in one tick must stop here — a second step would queue
   * the same cell again.
   */
  readonly deferred: boolean
}
