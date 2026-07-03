/**
 * A uniform grid over a toroidal (wrapping) world, used for O(1)-ish
 * neighbour queries instead of an O(n²) scan. Candidates are gathered from
 * nearby cells (including cells reached by wrapping around an edge) and then
 * filtered by an exact wrapped distance check, so results are precise, not
 * an approximation of the grid.
 *
 * Internals are allocation-free per step: buckets are flat arrays reused
 * across `clear()` calls, cell addressing is numeric (no string keys), and
 * `queryRadiusInto` writes matches into a caller-owned scratch array.
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
  /** cols × rows buckets of point indices, emptied in place by clear(). */
  private readonly buckets: number[][]
  private readonly posX: number[] = []
  private readonly posY: number[] = []

  constructor(
    private readonly cellSize: number,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    this.buckets = Array.from({ length: this.cols * this.rows }, () => [])
  }

  clear(): void {
    for (const bucket of this.buckets) bucket.length = 0
  }

  insert(index: number, x: number, y: number): void {
    const cx = wrapIndex(Math.floor(x / this.cellSize), this.cols)
    const cy = wrapIndex(Math.floor(y / this.cellSize), this.rows)
    this.buckets[cx + cy * this.cols]?.push(index)
    this.posX[index] = x
    this.posY[index] = y
  }

  /** Indices of every inserted point within `radius` of (x, y), wrap-aware. */
  queryRadius(x: number, y: number, radius: number): number[] {
    const out: number[] = []
    this.queryRadiusInto(x, y, radius, out)
    return out
  }

  /**
   * As `queryRadius`, but fills (and truncates) the caller-owned `out`
   * array instead of allocating. Returns the match count.
   */
  queryRadiusInto(x: number, y: number, radius: number, out: number[]): number {
    const cellRadius = Math.max(1, Math.ceil(radius / this.cellSize))
    const cx0 = Math.floor(x / this.cellSize) - cellRadius
    const cy0 = Math.floor(y / this.cellSize) - cellRadius
    const radiusSq = radius * radius
    // Wrapped spans, deduped: a span capped at the axis cell count visits
    // each cell on that axis exactly once (replaces the old seen-cells Set).
    const spanX = Math.min(2 * cellRadius + 1, this.cols)
    const spanY = Math.min(2 * cellRadius + 1, this.rows)
    let found = 0

    for (let ix = 0; ix < spanX; ix++) {
      const cx = wrapIndex(cx0 + ix, this.cols)
      for (let iy = 0; iy < spanY; iy++) {
        const cy = wrapIndex(cy0 + iy, this.rows)
        const bucket = this.buckets[cx + cy * this.cols]
        if (!bucket) continue
        for (const index of bucket) {
          const ddx = wrappedDelta(x, this.posX[index] ?? 0, this.width)
          const ddy = wrappedDelta(y, this.posY[index] ?? 0, this.height)
          if (ddx * ddx + ddy * ddy <= radiusSq) out[found++] = index
        }
      }
    }
    out.length = found
    return found
  }
}
