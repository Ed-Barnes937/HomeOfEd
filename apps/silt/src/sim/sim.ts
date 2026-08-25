import { CellApi } from './api.ts'
import { EMPTY, v1Elements, v1Reactions } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { DeferredMoves } from './moves.ts'
import { Grid } from './grid.ts'
import { applyArchetype } from './kernels.ts'
import { applyLifetime, applyReactions } from './lifecycle.ts'
import { createRegistry, type ElementRegistry } from './registry.ts'
import { Rng } from './rng.ts'
import type { Chunk } from './chunks.ts'
import type { ElementDef, ReactionRow } from './types.ts'

export interface SimOptions {
  /** Per-session, not persisted — determinism serves tests, not replay. */
  seed?: number
  elements?: readonly ElementDef[]
  reactions?: readonly ReactionRow[]
}

/**
 * The world. Headless and DOM-free: it owns the grid, the PRNG and the tick,
 * and knows nothing about canvases or frames.
 *
 * ## The clock trick
 *
 * The scan mutates the grid in place, so a cell that falls into a not-yet-
 * visited position would otherwise be processed twice in one tick. Every write
 * stamps the cell's `clock` with this tick's value and the scan skips cells
 * already carrying it. Cells that are visited but do not move are stamped too,
 * which keeps every occupied cell on the same value at tick boundaries — so the
 * byte wrapping every 256 ticks can never make the scan skip a settled cell.
 *
 * Chunk sleeping (ticket 05) would break that invariant on its own: a cell in a
 * sleeping chunk goes unstamped for as long as it sleeps, and 256 ticks later
 * its stale value could collide with the live one. So each tick opens with a
 * pass that stamps every cell it is about to scan with the settled clock — the
 * invariant is restored on wake rather than maintained while asleep, and the
 * pass runs over *all* awake chunks before *any* of them is scanned, so it can
 * never un-stamp a cell that an earlier chunk just moved.
 */
export class Sim {
  readonly width = GRID_WIDTH
  readonly height = GRID_HEIGHT
  readonly registry: ElementRegistry

  #grid: Grid
  #seed: number
  #rng: Rng
  #moves: DeferredMoves
  #api: CellApi
  #generation = 0
  #scanned = 0
  #revision = 0

  constructor(options: SimOptions = {}) {
    const { seed = 1, elements = v1Elements, reactions = v1Reactions } = options
    this.registry = createRegistry(elements, reactions)
    this.#grid = new Grid(GRID_WIDTH, GRID_HEIGHT)
    this.#seed = seed
    this.#rng = new Rng(seed)
    this.#moves = new DeferredMoves()
    this.#api = new CellApi(this.#grid, this.registry, this.#rng, this.#moves)
  }

  /** Ticks completed. Also the parity that flips the horizontal scan. */
  get generation(): number {
    return this.#generation
  }

  /**
   * Bumps on everything that can change what the world looks like — `tick`,
   * `paint`, `clear`, `restore` — and on nothing else. A renderer holding the
   * revision it last drew knows whether a redraw would produce a new picture
   * (ticket 06). Deliberately coarser than the grid: a tick that moved nothing
   * still bumps it, because proving otherwise costs more than the redraw.
   */
  get revision(): number {
    return this.#revision
  }

  /** The single transferable buffer holding the whole world. */
  get buffer(): ArrayBuffer {
    return this.#grid.buffer
  }

  /** Interleaved `{ species, ra, rb, clock }` view over `buffer`. */
  get cells(): Uint8Array {
    return this.#grid.cells
  }

  speciesAt(x: number, y: number): number {
    return this.#grid.speciesAt(x, y)
  }

  /**
   * Cells the last tick actually visited. Chunk sleeping leaves no trace in the
   * grid, so this is how the skip path is asserted — it is observability, not
   * simulation state.
   */
  get scannedLastTick(): number {
    return this.#scanned
  }

  /**
   * Stamped with the settled-cell clock so the next tick still considers it —
   * painting between ticks must not cost the grain a tick of falling.
   */
  paint(x: number, y: number, species: number): void {
    if (species !== EMPTY && !this.registry.get(species)) {
      throw new Error(`unknown species ${species}`)
    }
    this.#grid.write(x, y, species, this.#settledClock())
    // `write` only marks the chunk dirty for the *next* tick; a paint lands
    // between ticks, so it has to wake the chunk for the one about to run.
    this.#grid.chunks.activate(x, y)
    this.#revision++
  }

  /**
   * Back to a freshly constructed world — cells, generation and the RNG stream
   * all rewound, so what you paint next replays exactly as it did the first
   * time. (Spawners are entities rather than cells; reset clears those too,
   * from ticket 08.)
   */
  clear(): void {
    this.#grid.clear()
    this.#moves.clear()
    this.#generation = 0
    this.#scanned = 0
    this.#rng.reset(this.#seed)
    this.#revision++
  }

  /**
   * Replace the world with saved planes (ticket 09). The three planes are
   * full-grid and separate — `clock` is not among them, because it is
   * bookkeeping for a tick that is not happening: everything lands on the
   * freshly cleared generation 0. Every occupied cell is activated, so the
   * first tick after a load scans the world it was handed rather than a
   * sleeping one.
   */
  restore(species: Uint8Array, ra: Uint8Array, rb: Uint8Array): void {
    const size = this.width * this.height
    if (species.length !== size || ra.length !== size || rb.length !== size) {
      throw new Error(`restore expects three planes of ${size} bytes`)
    }

    this.clear()
    const grid = this.#grid
    for (let i = 0; i < size; i++) {
      const id = species[i]!
      if (id === EMPTY) continue
      if (!this.registry.get(id)) throw new Error(`unknown species ${id}`)
      const x = i % this.width
      const y = (i / this.width) | 0
      grid.write(x, y, id, this.#settledClock())
      grid.setRa(x, y, ra[i]!)
      grid.setRb(x, y, rb[i]!)
      grid.chunks.activate(x, y)
    }
    this.#revision++
  }

  /**
   * One fixed-timestep step, chunk by chunk.
   *
   * Chunk rows run bottom-up and cell rows within a chunk run bottom-up, so a
   * falling grain still travels exactly one cell per tick rather than being
   * carried along by the scan. Horizontal direction alternates by generation —
   * across chunks *and* within one — which buys left/right fairness without
   * spending RNG on it. **The order is fixed for a given generation**: a
   * row-major array of chunks, indexed arithmetically. Nothing iterates a hash.
   *
   * Chunks with no occupied cells, or with nothing dirty near them, are skipped
   * outright. Moves that leave a chunk are queued and committed at the end —
   * see `DeferredMoves` for the PRNG tie-break.
   */
  tick(): void {
    const clock = this.#nextClock()
    const chunks = this.#grid.chunks
    const rightToLeft = this.#generation % 2 === 0

    this.#restoreClockGuard()

    this.#scanned = 0
    for (let cy = chunks.rows - 1; cy >= 0; cy--) {
      for (let i = 0; i < chunks.cols; i++) {
        const cx = rightToLeft ? chunks.cols - 1 - i : i
        this.#scanChunk(chunks.at(cx, cy), clock, rightToLeft)
      }
    }

    this.#moves.resolve(this.#grid, this.registry, this.#rng, clock)
    chunks.endFrame()
    this.#generation++
    this.#revision++
  }

  /** See the class comment: stamp everything about to be scanned, first. */
  #restoreClockGuard(): void {
    const settled = this.#settledClock()
    for (const chunk of this.#grid.chunks.all) {
      if (!chunk.awake) continue
      const area = chunk.active
      for (let y = area.minY; y <= area.maxY; y++) {
        for (let x = area.minX; x <= area.maxX; x++) {
          this.#grid.stamp(x, y, settled)
        }
      }
    }
  }

  #scanChunk(chunk: Chunk, clock: number, rightToLeft: boolean): void {
    if (!chunk.awake) return

    const grid = this.#grid
    const area = chunk.active
    const width = area.maxX - area.minX + 1

    for (let y = area.maxY; y >= area.minY; y--) {
      for (let i = 0; i < width; i++) {
        const x = rightToLeft ? area.maxX - i : area.minX + i
        const species = grid.speciesAt(x, y)
        if (species === EMPTY) continue
        if (grid.clockAt(x, y) === clock) continue

        const def = this.registry.get(species)
        if (!def) continue

        grid.stamp(x, y, clock)
        this.#api.moveTo(x, y, clock)
        applyArchetype(this.#api, def.archetype)
        this.#scanned++
        this.#afterMovement(def)
      }
    }
  }

  /**
   * Everything that happens to a cell once its archetype has had its turn:
   * react with a neighbour, then age, then run the element's own hook. None of
   * these move anything, which is what makes running them after movement safe.
   *
   * Each step can transmute the cell, and a cell that is no longer this element
   * must not go on running its code — so each step is gated on the last. The
   * cursor is wherever movement left it (or where it started, if the move was
   * only queued), so all of this is relative to the cell's new home.
   */
  #afterMovement(def: ElementDef): void {
    const api = this.#api

    applyReactions(api, this.registry)
    if (api.get(0, 0) !== def.id) return

    const lifetime = this.registry.lifetimeOf(def.id)
    if (lifetime && !applyLifetime(api, lifetime)) return

    def.onTick?.(api)
  }

  #nextClock(): number {
    return (this.#generation + 1) & 0xff
  }

  /** The stamp every cell carries once a tick has finished. */
  #settledClock(): number {
    return this.#generation & 0xff
  }
}
