/**
 * A uniform grid over a toroidal (wrapping) world, used for O(1)-ish
 * neighbour queries instead of an O(n²) scan. Candidates are gathered from
 * nearby cells (including cells reached by wrapping around an edge) and then
 * filtered by an exact wrapped distance check, so results are precise, not
 * an approximation of the grid.
 */
function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n
}

/** Shortest signed delta from a to b on a wrapping axis of the given size. */
function wrappedDelta(a: number, b: number, size: number): number {
  let d = b - a
  if (d > size / 2) d -= size
  if (d < -size / 2) d += size
  return d
}

export class SpatialHash {
  private readonly cols: number
  private readonly rows: number
  private readonly cells = new Map<string, number[]>()
  private readonly positions = new Map<number, { x: number; y: number }>()

  constructor(
    private readonly cellSize: number,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
  }

  clear(): void {
    this.cells.clear()
    this.positions.clear()
  }

  insert(index: number, x: number, y: number): void {
    const key = this.cellKeyFor(x, y)
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(index)
    else this.cells.set(key, [index])
    this.positions.set(index, { x, y })
  }

  /** Indices of every inserted point within `radius` of (x, y), wrap-aware. */
  queryRadius(x: number, y: number, radius: number): number[] {
    const cellRadius = Math.max(1, Math.ceil(radius / this.cellSize))
    const cx0 = Math.floor(x / this.cellSize)
    const cy0 = Math.floor(y / this.cellSize)
    const found: number[] = []
    const seenCells = new Set<string>()

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${wrapIndex(cx0 + dx, this.cols)},${wrapIndex(cy0 + dy, this.rows)}`
        if (seenCells.has(key)) continue
        seenCells.add(key)
        const bucket = this.cells.get(key)
        if (!bucket) continue
        for (const index of bucket) {
          const pos = this.positions.get(index)
          if (!pos) continue
          const ddx = wrappedDelta(x, pos.x, this.width)
          const ddy = wrappedDelta(y, pos.y, this.height)
          if (Math.hypot(ddx, ddy) <= radius) found.push(index)
        }
      }
    }
    return found
  }

  private cellKeyFor(x: number, y: number): string {
    const cx = wrapIndex(Math.floor(x / this.cellSize), this.cols)
    const cy = wrapIndex(Math.floor(y / this.cellSize), this.rows)
    return `${cx},${cy}`
  }
}
