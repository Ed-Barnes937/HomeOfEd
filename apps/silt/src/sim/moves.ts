import { canDisplace, type ElementRegistry } from './registry.ts'
import type { Grid } from './grid.ts'
import type { Rng } from './rng.ts'

interface Move {
  /** Cell index `y * width + x`, so a destination clash is an integer match. */
  src: number
  dst: number
  /** What asked to move. An in-chunk move may have replaced it since. */
  species: number
}

/**
 * Moves that would leave the chunk being scanned (spec §5.3). A chunk only ever
 * writes inside itself; anything crossing an edge is queued here and committed
 * after every chunk has run, which is what makes the per-chunk scan independent
 * of its neighbours (and, one day, parallelisable).
 *
 * ## The determinism trap
 *
 * Two cells in different chunks can queue the same destination. The winner is
 * drawn from the **sim's seeded PRNG**, never from arrival order or a hash
 * iteration: the list is sorted into a total order by `(dst, src)` first, so
 * the candidates a draw chooses between are in the same sequence for a given
 * seed no matter which chunk queued first.
 */
export class DeferredMoves {
  #list: Move[] = []

  get size(): number {
    return this.#list.length
  }

  push(src: number, dst: number, species: number): void {
    this.#list.push({ src, dst, species })
  }

  clear(): void {
    this.#list.length = 0
  }

  /**
   * Commit the queue and empty it. Each winner is re-checked against the grid
   * as it stands now — the world moved on while the move sat in the queue, and
   * a stale move must be dropped rather than overwrite whatever took its place.
   */
  resolve(grid: Grid, registry: ElementRegistry, rng: Rng, clock: number): void {
    if (this.#list.length === 0) return

    this.#list.sort((a, b) => a.dst - b.dst || a.src - b.src)

    let i = 0
    while (i < this.#list.length) {
      let j = i + 1
      while (j < this.#list.length && this.#list[j]!.dst === this.#list[i]!.dst) j++

      const contenders = j - i
      const winner = this.#list[contenders === 1 ? i : i + rng.randInt(contenders)]!
      this.#apply(grid, registry, winner, clock)
      i = j
    }

    this.clear()
  }

  #apply(grid: Grid, registry: ElementRegistry, move: Move, clock: number): void {
    const sx = grid.xOf(move.src)
    const sy = grid.yOf(move.src)
    const dx = grid.xOf(move.dst)
    const dy = grid.yOf(move.dst)

    if (grid.speciesAt(sx, sy) !== move.species) return
    if (!canDisplace(registry, move.species, grid.speciesAt(dx, dy))) return

    grid.swap(sx, sy, dx, dy, clock)
  }
}
