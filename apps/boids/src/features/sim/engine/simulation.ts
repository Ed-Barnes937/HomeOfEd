import { clampParams, type SimParams } from './params.ts'
import { SpatialHash } from './spatialHash.ts'

/** [0,1) — prod injects Math.random, tests inject a seeded generator. */
export type Rng = () => number

export interface Boid {
  x: number
  y: number
  vx: number
  vy: number
  colorIndex: number
}

// Fixed internals — not sliders (spec §4).
const SEPARATION_RADIUS_FACTOR = 0.5
const MIN_SPEED_FACTOR = 0.4
/** maxForce = maxSpeed * this. Tuned so a boid can fully redirect in ~1/3s. */
const MAX_FORCE_FACTOR = 3
const MAX_DT_MS = 33
/**
 * Cursor-force influence radius in world (CSS) px, with linear falloff to 0 at
 * the edge. Exported so the pull-range overlay sizes itself to the exact same
 * number the physics uses (no visual/physics drift).
 */
export const CURSOR_RADIUS = 180

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

/** Shortest signed delta from a to b on a wrapping axis of the given size. */
function wrappedAxisDelta(a: number, b: number, size: number): number {
  let d = b - a
  if (d > size / 2) d -= size
  if (d < -size / 2) d += size
  return d
}

export class Simulation {
  private width: number
  private height: number
  private params: SimParams
  private readonly rng: Rng
  private hash: SpatialHash
  /** Pointer position in world px, or null when off-canvas. Fed each frame. */
  private pointer: { x: number; y: number } | null = null
  private readonly boidList: Boid[] = []
  // Per-step scratch, reused across frames so step() allocates nothing.
  private forceX = new Float64Array(0)
  private forceY = new Float64Array(0)
  private readonly neighbourScratch: number[] = []

  constructor(opts: { width: number; height: number; params: SimParams; rng: Rng }) {
    this.width = opts.width
    this.height = opts.height
    this.params = clampParams(opts.params)
    this.rng = opts.rng
    this.hash = new SpatialHash(this.params.vision, this.width, this.height)
    this.spawnTo(this.params.count)
  }

  get boids(): ReadonlyArray<Boid> {
    return this.boidList
  }

  /** Set (or clear, with null) the pointer the cursor force steers toward/away. */
  setPointer(pointer: { x: number; y: number } | null): void {
    this.pointer = pointer
  }

  getPointer(): { x: number; y: number } | null {
    return this.pointer
  }

  setParams(params: SimParams): void {
    this.params = clampParams(params)
    this.hash = new SpatialHash(this.params.vision, this.width, this.height)
    if (this.boidList.length !== this.params.count) this.spawnTo(this.params.count)
  }

  /** Resize: rebuild the hash for the new bounds and re-wrap existing boids. */
  setBounds(width: number, height: number): void {
    this.width = width
    this.height = height
    this.hash = new SpatialHash(this.params.vision, width, height)
    for (const b of this.boidList) {
      b.x = wrap(b.x, width)
      b.y = wrap(b.y, height)
    }
  }

  step(dtMs: number): void {
    const dt = Math.min(dtMs, MAX_DT_MS) / 1000
    const maxSpeed = this.params.speed * 60
    const minSpeed = maxSpeed * MIN_SPEED_FACTOR
    const maxForce = maxSpeed * MAX_FORCE_FACTOR
    const visionRadius = this.params.vision
    const separationRadius = visionRadius * SEPARATION_RADIUS_FACTOR

    const boids = this.boidList
    const n = boids.length

    this.hash.clear()
    for (let i = 0; i < n; i++) {
      const b = boids[i]
      if (b) this.hash.insert(i, b.x, b.y)
    }

    if (this.forceX.length < n) {
      this.forceX = new Float64Array(n)
      this.forceY = new Float64Array(n)
    }

    // Steer everyone from the same position/velocity snapshot, then integrate.
    for (let i = 0; i < n; i++) {
      this.steerFor(i, visionRadius, separationRadius, maxSpeed, maxForce)
    }

    for (let i = 0; i < n; i++) {
      const boid = boids[i]
      if (!boid) continue
      let vx = boid.vx + (this.forceX[i] ?? 0) * dt
      let vy = boid.vy + (this.forceY[i] ?? 0) * dt
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed > 0) {
        const clamped = Math.min(maxSpeed, Math.max(minSpeed, speed))
        vx = (vx / speed) * clamped
        vy = (vy / speed) * clamped
      }
      boid.vx = vx
      boid.vy = vy
      boid.x = wrap(boid.x + vx * dt, this.width)
      boid.y = wrap(boid.y + vy * dt, this.height)
    }
  }

  /** Writes the combined steering force for boid `index` into forceX/forceY. */
  private steerFor(
    index: number,
    visionRadius: number,
    separationRadius: number,
    maxSpeed: number,
    maxForce: number,
  ): void {
    this.forceX[index] = 0
    this.forceY[index] = 0
    const boid = this.boidList[index]
    if (!boid) return
    const neighbourCount = this.hash.queryRadiusInto(
      boid.x,
      boid.y,
      visionRadius,
      this.neighbourScratch,
    )
    const separationRadiusSq = separationRadius * separationRadius

    let separationX = 0
    let separationY = 0
    let separationCount = 0
    let velocitySumX = 0
    let velocitySumY = 0
    let positionDeltaX = 0
    let positionDeltaY = 0
    let flockCount = 0

    for (let k = 0; k < neighbourCount; k++) {
      const j = this.neighbourScratch[k]
      if (j === index || j === undefined) continue
      const other = this.boidList[j]
      if (!other) continue
      const dx = wrappedAxisDelta(boid.x, other.x, this.width)
      const dy = wrappedAxisDelta(boid.y, other.y, this.height)
      const distSq = dx * dx + dy * dy

      flockCount++
      velocitySumX += other.vx
      velocitySumY += other.vy
      positionDeltaX += dx
      positionDeltaY += dy

      if (distSq > 0 && distSq <= separationRadiusSq) {
        separationX -= dx / distSq
        separationY -= dy / distSq
        separationCount++
      }
    }

    if (separationCount > 0) {
      this.addSteer(index, separationX, separationY, this.params.separation, maxSpeed, maxForce)
    }
    if (flockCount > 0) {
      this.addSteer(
        index,
        velocitySumX / flockCount,
        velocitySumY / flockCount,
        this.params.alignment,
        maxSpeed,
        maxForce,
      )
      this.addSteer(
        index,
        positionDeltaX / flockCount,
        positionDeltaY / flockCount,
        this.params.cohesion,
        maxSpeed,
        maxForce,
      )
    }

    // Cursor force: steer toward the pointer (attract, cursor > 0) or away
    // (repel, cursor < 0), with linear falloff to 0 at CURSOR_RADIUS. Direct
    // (non-wrapped) delta — the pointer is a screen-anchored point. Runs inside
    // steerFor so it shares the snapshot and accumulates via addSteer like every
    // other rule; depends only on the pointer + this boid, never neighbours.
    if (this.pointer && this.params.cursor !== 0) {
      const dx = this.pointer.x - boid.x
      const dy = this.pointer.y - boid.y
      const dist = Math.hypot(dx, dy)
      if (dist > 0 && dist < CURSOR_RADIUS) {
        const falloff = 1 - dist / CURSOR_RADIUS
        const sign = Math.sign(this.params.cursor)
        this.addSteer(
          index,
          dx * sign,
          dy * sign,
          Math.abs(this.params.cursor) * falloff,
          maxSpeed,
          maxForce,
        )
      }
    }
  }

  /**
   * One Reynolds rule, scalarised: steer = limit(weight × (setMag(sum,
   * maxSpeed) − velocity), maxForce), accumulated into forceX/forceY.
   */
  private addSteer(
    index: number,
    sumX: number,
    sumY: number,
    weight: number,
    maxSpeed: number,
    maxForce: number,
  ): void {
    const boid = this.boidList[index]
    if (!boid) return
    const mag = Math.sqrt(sumX * sumX + sumY * sumY)
    // setMagnitude leaves the zero vector at zero, so raw = −velocity there.
    let fx = (mag > 0 ? (sumX / mag) * maxSpeed : 0) - boid.vx
    let fy = (mag > 0 ? (sumY / mag) * maxSpeed : 0) - boid.vy
    fx *= weight
    fy *= weight
    const forceMag = Math.sqrt(fx * fx + fy * fy)
    if (forceMag > maxForce) {
      fx = (fx / forceMag) * maxForce
      fy = (fy / forceMag) * maxForce
    }
    this.forceX[index] = (this.forceX[index] ?? 0) + fx
    this.forceY[index] = (this.forceY[index] ?? 0) + fy
  }

  /** Grow/shrink the flock to `count`, appending or truncating — never resets survivors. */
  private spawnTo(count: number): void {
    if (count < this.boidList.length) {
      this.boidList.length = count
      return
    }
    const maxSpeed = this.params.speed * 60
    while (this.boidList.length < count) {
      const angle = this.rng() * Math.PI * 2
      this.boidList.push({
        x: this.rng() * this.width,
        y: this.rng() * this.height,
        vx: Math.cos(angle) * maxSpeed * 0.6,
        vy: Math.sin(angle) * maxSpeed * 0.6,
        colorIndex: this.boidList.length,
      })
    }
  }
}
