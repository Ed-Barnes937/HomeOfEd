import { EMPTY, WALL } from './elements.ts'
import type { Grid } from './grid.ts'
import type { ElementRegistry } from './registry.ts'
import type { Rng } from './rng.ts'
import type { MovementApi } from './types.ts'

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
  #x = 0
  #y = 0
  #clock = 0

  constructor(grid: Grid, registry: ElementRegistry, rng: Rng) {
    this.#grid = grid
    this.#registry = registry
    this.#rng = rng
  }

  /** Point the cursor at a cell before dispatching its archetype. */
  moveTo(x: number, y: number, clock: number): void {
    this.#x = x
    this.#y = y
    this.#clock = clock
  }

  get(dx: number, dy: number): number {
    return this.#grid.speciesAt(this.#x + dx, this.#y + dy)
  }

  set(dx: number, dy: number, species: number): void {
    this.#grid.write(this.#x + dx, this.#y + dy, species, this.#clock)
  }

  swap(dx: number, dy: number): void {
    const tx = this.#x + dx
    const ty = this.#y + dy
    if (!this.#grid.inBounds(tx, ty)) return
    this.#grid.swap(this.#x, this.#y, tx, ty, this.#clock)
    this.#x = tx
    this.#y = ty
  }

  become(species: number): void {
    this.#grid.write(this.#x, this.#y, species, this.#clock)
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

  rand(): number {
    return this.#rng.rand()
  }

  randInt(maxExclusive: number): number {
    return this.#rng.randInt(maxExclusive)
  }

  tryMove(dx: number, dy: number): boolean {
    const target = this.get(dx, dy)
    if (target === WALL) return false

    if (target !== EMPTY) {
      // Displacement is strictly density-ordered: equal densities never swap,
      // or two neighbours would trade places forever.
      const mine = this.#registry.density(this.get(0, 0))
      const theirs = this.#registry.density(target)
      if (mine === undefined || theirs === undefined || mine <= theirs) {
        return false
      }
    }

    this.swap(dx, dy)
    return true
  }
}
