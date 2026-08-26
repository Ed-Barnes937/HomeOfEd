import { CHUNK_MARGIN, CHUNK_SIZE } from './constants.ts'

/**
 * An inclusive cell rectangle, or nothing at all. `maxX < minX` is the empty
 * form — cheaper than a nullable, and the only state a fresh rect is ever in.
 */
export class Rect {
  minX = 0
  minY = 0
  maxX = -1
  maxY = -1

  get isEmpty(): boolean {
    return this.maxX < this.minX
  }

  clear(): void {
    this.minX = 0
    this.minY = 0
    this.maxX = -1
    this.maxY = -1
  }

  include(minX: number, minY: number, maxX: number, maxY: number): void {
    if (this.isEmpty) {
      this.minX = minX
      this.minY = minY
      this.maxX = maxX
      this.maxY = maxY
      return
    }
    if (minX < this.minX) this.minX = minX
    if (minY < this.minY) this.minY = minY
    if (maxX > this.maxX) this.maxX = maxX
    if (maxY > this.maxY) this.maxY = maxY
  }
}

/**
 * One tile of the world, carrying the two things that let a tick skip it: a
 * count of occupied cells and a dirty rect.
 *
 * **Two rects, swapped at frame end** (spec §5.3). `active` is the region this
 * tick scans; every write during the tick lands in the *working* rect instead,
 * so a chunk's scan region cannot grow underneath the scan that is reading it.
 * `endFrame` promotes working to active and empties working.
 */
export class Chunk {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number

  /** Occupied (non-`EMPTY`) cells. Zero means the tick can skip the chunk. */
  filled = 0

  #active = new Rect()
  #working = new Rect()

  constructor(minX: number, minY: number, maxX: number, maxY: number) {
    this.minX = minX
    this.minY = minY
    this.maxX = maxX
    this.maxY = maxY
  }

  /** The region this tick scans. Read-only to callers by convention. */
  get active(): Rect {
    return this.#active
  }

  /** The region the *next* tick will scan, as accumulated so far. */
  get working(): Rect {
    return this.#working
  }

  /** Nothing to do when the chunk is empty or nothing near it changed. */
  get awake(): boolean {
    return this.filled > 0 && !this.#active.isEmpty
  }

  /** Dirty for the next tick. */
  touch(minX: number, minY: number, maxX: number, maxY: number): void {
    this.#include(this.#working, minX, minY, maxX, maxY)
  }

  /** Dirty for the tick about to run — painting happens between ticks. */
  activate(minX: number, minY: number, maxX: number, maxY: number): void {
    this.#include(this.#active, minX, minY, maxX, maxY)
  }

  endFrame(): void {
    const promoted = this.#working
    this.#working = this.#active
    this.#active = promoted
    this.#working.clear()
  }

  /** Back to never-touched: no occupants, nothing dirty either side. */
  reset(): void {
    this.filled = 0
    this.#active.clear()
    this.#working.clear()
  }

  #include(rect: Rect, minX: number, minY: number, maxX: number, maxY: number): void {
    rect.include(
      Math.max(minX, this.minX),
      Math.max(minY, this.minY),
      Math.min(maxX, this.maxX),
      Math.min(maxY, this.maxY),
    )
  }
}

/**
 * The fixed tiling of the world (spec §5.3). Structure only: v1 runs every
 * chunk on one thread, in a fixed order, and the payoff is the sleep path
 * rather than parallelism.
 *
 * `all` is a plain row-major array and is the *only* ordering anything iterates
 * — never a `Map`, whose order would be an accident of insertion and one of the
 * two ways chunking silently destroys determinism.
 */
export class ChunkMap {
  readonly cols: number
  readonly rows: number
  readonly all: readonly Chunk[]

  #width: number
  #height: number
  #size: number
  /**
   * `log2(size)` when the size is a power of two, so cell → chunk is a shift;
   * `-1` when it is not, and `#chunkOf` divides instead. `CHUNK_SIZE` is 32,
   * but the size is a constructor parameter and the tests pass odd ones.
   */
  #shift: number

  constructor(width: number, height: number, size = CHUNK_SIZE) {
    this.#width = width
    this.#height = height
    this.#size = size
    const shift = Math.log2(size)
    this.#shift = Number.isInteger(shift) ? shift : -1
    this.cols = Math.ceil(width / size)
    this.rows = Math.ceil(height / size)

    const chunks: Chunk[] = []
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        chunks.push(
          new Chunk(
            cx * size,
            cy * size,
            Math.min((cx + 1) * size, width) - 1,
            Math.min((cy + 1) * size, height) - 1,
          ),
        )
      }
    }
    this.all = chunks
  }

  /**
   * Cell coordinate → chunk coordinate. `value` is always non-negative here, so
   * `| 0` truncates exactly as `Math.floor` rounds.
   */
  #chunkOf(value: number): number {
    return this.#shift >= 0 ? value >> this.#shift : (value / this.#size) | 0
  }

  at(cx: number, cy: number): Chunk {
    return this.all[cy * this.cols + cx]!
  }

  /** Which chunk owns a cell. Out-of-bounds cells answer -1. */
  indexAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return -1
    return this.#chunkOf(y) * this.cols + this.#chunkOf(x)
  }

  /**
   * Mark a changed cell dirty for the next tick, with the 2-cell margin. The
   * margin can cross chunk edges, so up to nine chunks are marked.
   */
  touch(x: number, y: number): void {
    this.#spread(x, y, false)
  }

  /** Same, but for the tick about to run — see `Chunk.activate`. */
  activate(x: number, y: number): void {
    this.#spread(x, y, true)
  }

  addFilled(x: number, y: number, delta: number): void {
    const index = this.indexAt(x, y)
    if (index >= 0) this.all[index]!.filled += delta
  }

  /** Promote every working rect to active. Called once, at tick end. */
  endFrame(): void {
    for (const chunk of this.all) chunk.endFrame()
  }

  clear(): void {
    for (const chunk of this.all) chunk.reset()
  }

  #spread(x: number, y: number, now: boolean): void {
    const minX = Math.max(x - CHUNK_MARGIN, 0)
    const minY = Math.max(y - CHUNK_MARGIN, 0)
    const maxX = Math.min(x + CHUNK_MARGIN, this.#width - 1)
    const maxY = Math.min(y + CHUNK_MARGIN, this.#height - 1)
    if (minX > maxX || minY > maxY) return

    const firstCol = this.#chunkOf(minX)
    const lastCol = this.#chunkOf(maxX)
    const firstRow = this.#chunkOf(minY)
    const lastRow = this.#chunkOf(maxY)

    for (let cy = firstRow; cy <= lastRow; cy++) {
      for (let cx = firstCol; cx <= lastCol; cx++) {
        const chunk = this.at(cx, cy)
        if (now) chunk.activate(minX, minY, maxX, maxY)
        else chunk.touch(minX, minY, maxX, maxY)
      }
    }
  }
}
