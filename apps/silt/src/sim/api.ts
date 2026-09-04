import { canDisplace, requireRaIsFree, type ElementRegistry } from './registry.ts'
import type { DeferredMoves } from './moves.ts'
import type { Grid } from './grid.ts'
import type { Rng } from './rng.ts'
import type { MovementApi, SetOptions } from './types.ts'
import type { WitnessTable } from './witness.ts'

/**
 * The one `Api` instance the sim reuses for every cell it visits — a cursor, not
 * an allocation. Sixty thousand cells at sixty ticks a second leaves no room for
 * per-cell objects.
 *
 * Everything it exposes is relative to `(x, y)`, and `swap` carries the cursor
 * along, so an element that has already moved this tick still addresses its
 * neighbours correctly.
 */
export class CellApi implements MovementApi {
  #grid: Grid
  #registry: ElementRegistry
  #rng: Rng
  #moves: DeferredMoves
  #witness: WitnessTable
  #x = 0
  #y = 0
  #clock = 0
  #deferred = false

  constructor(
    grid: Grid,
    registry: ElementRegistry,
    rng: Rng,
    moves: DeferredMoves,
    witness: WitnessTable,
  ) {
    this.#grid = grid
    this.#registry = registry
    this.#rng = rng
    this.#moves = moves
    this.#witness = witness
  }

  /** Point the cursor at a cell before dispatching its archetype. */
  moveTo(x: number, y: number, clock: number): void {
    this.#x = x
    this.#y = y
    this.#clock = clock
    this.#deferred = false
  }

  /** See `MovementApi.deferred` — set by the last `swap`, read by the kernels. */
  get deferred(): boolean {
    return this.#deferred
  }

  get(dx: number, dy: number): number {
    return this.#grid.speciesAt(this.#x + dx, this.#y + dy)
  }

  /**
   * `options.ra` is how a travelling per-cell budget gets from one cell to the
   * next (spec §2.2): the hook writes the new cell *with* its state rather than
   * swapping into it and backfilling, which would be movement inside a hook.
   * The guard runs before the write, so a refused call leaves the world exactly
   * as it was.
   */
  set(dx: number, dy: number, species: number, options?: SetOptions): void {
    const ra = options?.ra
    if (ra !== undefined) requireRaIsFree(this.#registry, species)

    const x = this.#x + dx
    const y = this.#y + dy
    this.#grid.write(x, y, species, this.#clock, this.#variant())
    if (ra !== undefined) this.#grid.setRa(x, y, ra)
  }

  /**
   * In-chunk moves land immediately and carry the cursor. A move that would
   * leave the chunk is **queued instead** (spec §5.3) and committed once every
   * chunk has run — so the cursor stays put, and a queued move can still be
   * dropped if it loses the destination or the world moves under it.
   */
  swap(dx: number, dy: number): void {
    const tx = this.#x + dx
    const ty = this.#y + dy
    this.#deferred = false
    if (!this.#grid.inBounds(tx, ty)) return

    const chunks = this.#grid.chunks
    if (chunks.indexAt(tx, ty) !== chunks.indexAt(this.#x, this.#y)) {
      const grid = this.#grid
      this.#moves.push(grid.indexOf(this.#x, this.#y), grid.indexOf(tx, ty), this.get(0, 0))
      this.#deferred = true
      return
    }

    this.#grid.swap(this.#x, this.#y, tx, ty, this.#clock)
    this.#x = tx
    this.#y = ty
  }

  become(species: number): void {
    this.#grid.write(this.#x, this.#y, species, this.#clock, this.#variant())
  }

  /**
   * A colour variant for a cell being born here. Seeded centrally so that every
   * transmutation gets one — water→steam→water would otherwise collapse back to
   * variant 0 and the cloud would flatten into a slab. Drawn from the sim PRNG,
   * so determinism holds.
   */
  #variant(): number {
    return this.#rng.randInt(256)
  }

  has(dx: number, dy: number, tag: string): boolean {
    return this.#registry.has(this.get(dx, dy), tag)
  }

  get ra(): number {
    return this.#grid.raAt(this.#x, this.#y)
  }

  set ra(value: number) {
    this.#grid.setRa(this.#x, this.#y, value)
  }

  get rb(): number {
    return this.#grid.rbAt(this.#x, this.#y)
  }

  set rb(value: number) {
    this.#grid.setRb(this.#x, this.#y, value)
  }

  raAt(dx: number, dy: number): number {
    return this.#grid.raAt(this.#x + dx, this.#y + dy)
  }

  setRaAt(dx: number, dy: number, value: number): void {
    this.#grid.setRa(this.#x + dx, this.#y + dy, value)
  }

  rand(): number {
    return this.#rng.rand()
  }

  randInt(maxExclusive: number): number {
    return this.#rng.randInt(maxExclusive)
  }

  /**
   * See `Api.witnessGrowth`. The grower is read off the cursor rather than
   * taken as an argument, so a hook cannot claim a growth it did not perform -
   * and the read costs a single indexed load, only on a tick that grew.
   */
  witnessGrowth(): void {
    this.#witness.growth(this.get(0, 0))
  }

  /**
   * True also for a move that was only *queued* because it left the chunk — the
   * kernel has committed to it and stops looking, and a queued move that later
   * loses its destination costs the cell that tick. Accepted: the alternative
   * is queuing several candidates and letting a cell arrive twice.
   */
  tryMove(dx: number, dy: number): boolean {
    if (!this.canMove(dx, dy)) return false
    this.swap(dx, dy)
    return true
  }

  canMove(dx: number, dy: number): boolean {
    return canDisplace(this.#registry, this.get(0, 0), this.get(dx, dy))
  }

  keepAwake(): void {
    this.#grid.chunks.touch(this.#x, this.#y)
  }
}
