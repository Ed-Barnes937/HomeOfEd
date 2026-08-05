/**
 * The element model (spec §5.2): **archetypes own movement, hooks own
 * transmutation**. Elements are pure config — an element that needs new *motion*
 * is a bug report against the archetype set, not a new hook.
 */

/**
 * Engine-owned, closed set of motion kernels. The spec closes it at four;
 * `liquid` and `gas` arrive with ticket 06. `applyArchetype` switches
 * exhaustively, so adding a variant here is a compile error until its kernel
 * exists.
 */
export type Archetype = { kind: 'static' } | { kind: 'powder'; density: number; slide: number }

/**
 * Engine-managed decay. Countdown lives in `ra` — see the byte-ownership rule
 * on `Api`. Executed in ticket 06; declared here so the registry can validate
 * `becomes` against the roster at boot.
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
 * keeps the table from going O(n²). Applied in ticket 06; validated at boot now.
 */
export interface ReactionRow {
  a: string
  b: string
  /** Per-contact probability, in (0, 1]. */
  p: number
  /** Element name the `a` side becomes, or `null` to clear the cell. */
  aBecomes: string | null
  bBecomes: string | null
  /** Only affects cells at or below this hardness. */
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
  /** At least one `#rrggbb`; the renderer picks a variant via `rb`. */
  colours: readonly string[]
  tags: readonly string[]
  archetype: Archetype
  hardness?: number
  lifetime?: Lifetime
  /**
   * At most one hook, run strictly *after* archetype movement so it can never
   * corrupt the movement invariant. Executed from ticket 06.
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
  /** Overwrite the cell at the offset, clearing its scratch bytes. */
  set(dx: number, dy: number, species: number): void
  /**
   * Exchange this cell with the one at the offset. The cursor follows, so
   * subsequent calls stay relative to the element's new home.
   */
  swap(dx: number, dy: number): void
  /** Transmute this cell in place, keeping its position. */
  become(species: number): void
  has(dx: number, dy: number, tag: string): boolean
  /** Scratch byte of this cell — owned by `lifetime`. */
  get ra(): number
  set ra(value: number)
  /** Scratch byte of this cell — owned by colour variant. */
  get rb(): number
  set rb(value: number)
  rand(): number
  randInt(maxExclusive: number): number
}

/**
 * Engine-internal extension used by the motion kernels. `tryMove` is where the
 * density ordering lives, so kernels never touch the registry themselves.
 */
export interface MovementApi extends Api {
  /** Move into the offset if it is empty or holds something less dense. */
  tryMove(dx: number, dy: number): boolean
}
