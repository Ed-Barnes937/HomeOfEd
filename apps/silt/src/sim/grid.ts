import { BYTES_PER_CELL, CLOCK_OFFSET, RA_OFFSET, RB_OFFSET, SPECIES_OFFSET } from './constants.ts'
import { ChunkMap } from './chunks.ts'
import { EMPTY, WALL } from './elements.ts'

/**
 * `#at` shifts instead of multiplying by `BYTES_PER_CELL`. The shift is derived
 * from the constant rather than hard-coded, and the assert below is what keeps
 * the two honest if the cell ever changes size to something not a power of two.
 */
const CELL_SHIFT = Math.log2(BYTES_PER_CELL)
if (!Number.isInteger(CELL_SHIFT)) {
  throw new Error(`BYTES_PER_CELL must be a power of two, got ${BYTES_PER_CELL}`)
}

/**
 * Cell storage: one interleaved `{ species, ra, rb, clock }` struct per cell in
 * a single `ArrayBuffer` (spec §5.1). Never objects-per-cell. The buffer is the
 * unit of transfer, so moving the sim into a worker is a `postMessage`, not a
 * restructure. Future per-cell fields (heat, wind…) become parallel grids —
 * the cell never widens.
 *
 * Reads outside the grid return the WALL sentinel; writes outside are dropped.
 *
 * Every mutation funnels through here, which makes this the one honest place to
 * keep the chunk bookkeeping (ticket 05): writes mark the containing chunks
 * dirty and keep their filled-cell counts true. `stamp` is deliberately exempt
 * — the clock guard touches every occupied cell each tick, so treating it as a
 * change would mean nothing ever slept.
 */
export class Grid {
  readonly width: number
  readonly height: number
  readonly buffer: ArrayBuffer
  readonly cells: Uint8Array
  readonly chunks: ChunkMap

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.buffer = new ArrayBuffer(width * height * BYTES_PER_CELL)
    this.cells = new Uint8Array(this.buffer)
    this.chunks = new ChunkMap(width, height)
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  /**
   * Cell index — the flat form used when a cell has to be named without a
   * cursor, as the deferred move list does. The `y * width + x` layout is the
   * grid's business, so the encoding stays here.
   */
  indexOf(x: number, y: number): number {
    return y * this.width + x
  }

  xOf(index: number): number {
    return index % this.width
  }

  yOf(index: number): number {
    // `index` is a cell index, so never negative — `| 0` truncates the same way
    // `Math.floor` rounds, for a fraction of the cost.
    return (index / this.width) | 0
  }

  /**
   * Byte index of a cell's first field — the base the four field offsets hang
   * off. Handed out so a caller reading several fields of the same cell pays
   * the arithmetic once; the `y * width + x` layout still lives only here, so
   * the base is opaque and only the `*AtBase` accessors below may read it.
   * Callers must have bounds-checked.
   */
  baseIndexOf(x: number, y: number): number {
    return this.#at(x, y, 0)
  }

  speciesAtBase(base: number): number {
    return this.cells[base + SPECIES_OFFSET]!
  }

  clockAtBase(base: number): number {
    return this.cells[base + CLOCK_OFFSET]!
  }

  /** `stamp` by base index. Marks nothing dirty — see `stamp`. */
  stampAtBase(base: number, clock: number): void {
    this.cells[base + CLOCK_OFFSET] = clock
  }

  /** Byte index of a field within a cell. Callers must have bounds-checked. */
  #at(x: number, y: number, field: number): number {
    return ((y * this.width + x) << CELL_SHIFT) + field
  }

  speciesAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return WALL
    return this.cells[this.#at(x, y, SPECIES_OFFSET)]!
  }

  // A WALL cell has empty scratch and no clock, so out-of-bounds reads of the
  // other three fields answer 0 — consistent with the sentinel, not a fallback.
  raAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0
    return this.cells[this.#at(x, y, RA_OFFSET)]!
  }

  rbAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0
    return this.cells[this.#at(x, y, RB_OFFSET)]!
  }

  clockAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0
    return this.cells[this.#at(x, y, CLOCK_OFFSET)]!
  }

  setRa(x: number, y: number, value: number): void {
    if (!this.inBounds(x, y)) return
    this.cells[this.#at(x, y, RA_OFFSET)] = value
    this.chunks.touch(x, y)
  }

  setRb(x: number, y: number, value: number): void {
    if (!this.inBounds(x, y)) return
    this.cells[this.#at(x, y, RB_OFFSET)] = value
    this.chunks.touch(x, y)
  }

  /** Write the double-update guard without disturbing the rest of the cell. */
  stamp(x: number, y: number, clock: number): void {
    if (!this.inBounds(x, y)) return
    this.cells[this.#at(x, y, CLOCK_OFFSET)] = clock
  }

  /**
   * Stamp a contiguous run of one row — the clock guard's shape, where the
   * whole rect is known in bounds and stamping cell by cell pays for a bounds
   * check and an index multiply per cell. Like `stamp`, and for the same
   * reason, this marks nothing dirty.
   */
  stampRow(y: number, minX: number, maxX: number, clock: number): void {
    if (y < 0 || y >= this.height) return
    const from = minX < 0 ? 0 : minX
    const to = maxX >= this.width ? this.width - 1 : maxX
    if (from > to) return

    const end = this.#at(to, y, CLOCK_OFFSET)
    for (let i = this.#at(from, y, CLOCK_OFFSET); i <= end; i += BYTES_PER_CELL) {
      this.cells[i] = clock
    }
  }

  /** Overwrite a whole cell, clearing its scratch bytes. */
  write(x: number, y: number, species: number, clock: number): void {
    if (!this.inBounds(x, y)) return
    const i = this.#at(x, y, 0)
    const before = this.cells[i + SPECIES_OFFSET]!
    this.cells[i + SPECIES_OFFSET] = species
    this.cells[i + RA_OFFSET] = 0
    this.cells[i + RB_OFFSET] = 0
    this.cells[i + CLOCK_OFFSET] = clock

    if ((before === EMPTY) !== (species === EMPTY)) {
      this.chunks.addFilled(x, y, species === EMPTY ? -1 : 1)
    }
    this.chunks.touch(x, y)
  }

  /**
   * Exchange two cells whole and stamp both, so neither is scanned again this
   * tick. Callers must have bounds-checked; out-of-bounds is a no-op.
   */
  swap(ax: number, ay: number, bx: number, by: number, clock: number): void {
    if (!this.inBounds(ax, ay) || !this.inBounds(bx, by)) return
    const a = this.#at(ax, ay, 0)
    const b = this.#at(bx, by, 0)
    const aWasEmpty = this.cells[a + SPECIES_OFFSET] === EMPTY
    const bWasEmpty = this.cells[b + SPECIES_OFFSET] === EMPTY
    for (let k = 0; k < BYTES_PER_CELL; k++) {
      const tmp = this.cells[a + k]!
      this.cells[a + k] = this.cells[b + k]!
      this.cells[b + k] = tmp
    }
    this.cells[a + CLOCK_OFFSET] = clock
    this.cells[b + CLOCK_OFFSET] = clock

    // Occupancy only moves when exactly one side was empty, and then it moves
    // between two chunks that may not be the same one.
    if (aWasEmpty !== bWasEmpty) {
      this.chunks.addFilled(ax, ay, aWasEmpty ? 1 : -1)
      this.chunks.addFilled(bx, by, bWasEmpty ? 1 : -1)
    }
    this.chunks.touch(ax, ay)
    this.chunks.touch(bx, by)
  }

  /** Zeroes all four bytes of every cell, not just the species. */
  clear(): void {
    this.cells.fill(0)
    this.chunks.clear()
  }
}
