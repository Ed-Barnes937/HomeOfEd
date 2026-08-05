import { CellApi } from './api.ts'
import { EMPTY, v1Elements } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { Grid } from './grid.ts'
import { applyArchetype } from './kernels.ts'
import { createRegistry, type ElementRegistry } from './registry.ts'
import { Rng } from './rng.ts'
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
 */
export class Sim {
  readonly width = GRID_WIDTH
  readonly height = GRID_HEIGHT
  readonly registry: ElementRegistry

  #grid: Grid
  #seed: number
  #rng: Rng
  #api: CellApi
  #generation = 0

  constructor(options: SimOptions = {}) {
    const { seed = 1, elements = v1Elements, reactions = [] } = options
    this.registry = createRegistry(elements, reactions)
    this.#grid = new Grid(GRID_WIDTH, GRID_HEIGHT)
    this.#seed = seed
    this.#rng = new Rng(seed)
    this.#api = new CellApi(this.#grid, this.registry, this.#rng)
  }

  /** Ticks completed. Also the parity that flips the horizontal scan. */
  get generation(): number {
    return this.#generation
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
   * Stamped with the settled-cell clock so the next tick still considers it —
   * painting between ticks must not cost the grain a tick of falling.
   */
  paint(x: number, y: number, species: number): void {
    if (species !== EMPTY && !this.registry.get(species)) {
      throw new Error(`unknown species ${species}`)
    }
    this.#grid.write(x, y, species, this.#settledClock())
  }

  /**
   * Back to a freshly constructed world — cells, generation and the RNG stream
   * all rewound, so what you paint next replays exactly as it did the first
   * time. (Spawners are entities rather than cells; reset clears those too,
   * from ticket 08.)
   */
  clear(): void {
    this.#grid.clear()
    this.#generation = 0
    this.#rng.reset(this.#seed)
  }

  /**
   * One fixed-timestep step. Rows run bottom-up so a falling grain travels one
   * cell per tick rather than being carried along by the scan; the horizontal
   * direction alternates by generation, which buys left/right fairness without
   * spending RNG on it.
   *
   * Chunked iteration (ticket 05) replaces the loop below and nothing else.
   */
  tick(): void {
    const clock = this.#nextClock()
    const grid = this.#grid
    const rightToLeft = this.#generation % 2 === 0

    for (let y = this.height - 1; y >= 0; y--) {
      for (let i = 0; i < this.width; i++) {
        const x = rightToLeft ? this.width - 1 - i : i
        const species = grid.speciesAt(x, y)
        if (species === EMPTY) continue
        if (grid.clockAt(x, y) === clock) continue

        const def = this.registry.get(species)
        if (!def) continue

        grid.stamp(x, y, clock)
        this.#api.moveTo(x, y, clock)
        applyArchetype(this.#api, def.archetype)
        // `def.onTick` runs here, strictly after movement — ticket 06.
      }
    }

    this.#generation++
  }

  #nextClock(): number {
    return (this.#generation + 1) & 0xff
  }

  /** The stamp every cell carries once a tick has finished. */
  #settledClock(): number {
    return this.#generation & 0xff
  }
}
