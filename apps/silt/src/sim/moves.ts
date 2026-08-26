import { canDisplace, type ElementRegistry } from './registry.ts'
import type { Grid } from './grid.ts'
import type { Rng } from './rng.ts'

/** Fields of one move, three `Int32Array` slots apart. */
const SRC = 0
const DST = 1
const SPECIES = 2
const STRIDE = 3

const INITIAL_CAPACITY = 64

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
 *
 * The queue is a flat `Int32Array` of `(src, dst, species)` triples rather than
 * an array of objects — a busy tick queues hundreds of moves, and an object per
 * move is an object per move straight into the nursery. The buffer grows by
 * doubling and is never handed back; `clear` only zeroes the count.
 *
 * Sorting a strided buffer in place is not a thing `sort` can do, so a parallel
 * `Uint32Array` of slot numbers is sorted instead and everything downstream
 * reads through it.
 *
 * **The comparator must end in `a - b`.** `(dst, src)` is *not* a total order:
 * two moves really can share both. A cell that queues a move stays where it is
 * — the cursor does not follow a deferred swap — so a later cell in the same
 * chunk can displace it, land on that same index, and queue from there in turn.
 * Measured on the bench scenarios, that happens. `a - b` is the push order, so
 * the ordering is total again and matches exactly what the old sort over
 * objects gave (`Array.prototype.sort` is stable, so equal keys kept insertion
 * order). Drop it and the winner of a tied pair rides on sort internals.
 */
export class DeferredMoves {
  #data = new Int32Array(INITIAL_CAPACITY * STRIDE)
  #order = new Uint32Array(INITIAL_CAPACITY)
  #count = 0

  get size(): number {
    return this.#count
  }

  push(src: number, dst: number, species: number): void {
    if (this.#count === this.#order.length) this.#grow()

    const at = this.#count * STRIDE
    this.#data[at + SRC] = src
    this.#data[at + DST] = dst
    this.#data[at + SPECIES] = species
    this.#count++
  }

  clear(): void {
    this.#count = 0
  }

  /**
   * Commit the queue and empty it. Each winner is re-checked against the grid
   * as it stands now — the world moved on while the move sat in the queue, and
   * a stale move must be dropped rather than overwrite whatever took its place.
   */
  resolve(grid: Grid, registry: ElementRegistry, rng: Rng, clock: number): void {
    if (this.#count === 0) return

    const data = this.#data
    const order = this.#order.subarray(0, this.#count)
    for (let i = 0; i < order.length; i++) order[i] = i
    order.sort(
      (a, b) =>
        data[a * STRIDE + DST]! - data[b * STRIDE + DST]! ||
        data[a * STRIDE + SRC]! - data[b * STRIDE + SRC]! ||
        a - b,
    )

    let i = 0
    while (i < order.length) {
      const dst = data[order[i]! * STRIDE + DST]
      let j = i + 1
      while (j < order.length && data[order[j]! * STRIDE + DST] === dst) j++

      const contenders = j - i
      const winner = order[contenders === 1 ? i : i + rng.randInt(contenders)]!
      this.#apply(grid, registry, winner, clock)
      i = j
    }

    this.clear()
  }

  #grow(): void {
    const data = new Int32Array(this.#data.length * 2)
    data.set(this.#data)
    this.#data = data
    this.#order = new Uint32Array(this.#order.length * 2)
  }

  #apply(grid: Grid, registry: ElementRegistry, slot: number, clock: number): void {
    const at = slot * STRIDE
    const species = this.#data[at + SPECIES]!
    const sx = grid.xOf(this.#data[at + SRC]!)
    const sy = grid.yOf(this.#data[at + SRC]!)
    const dx = grid.xOf(this.#data[at + DST]!)
    const dy = grid.yOf(this.#data[at + DST]!)

    if (grid.speciesAt(sx, sy) !== species) return
    if (!canDisplace(registry, species, grid.speciesAt(dx, dy))) return

    grid.swap(sx, sy, dx, dy, clock)
  }
}
