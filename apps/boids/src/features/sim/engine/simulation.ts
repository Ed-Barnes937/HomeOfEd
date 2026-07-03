import { clampParams, type SimParams } from './params.ts'
import { SpatialHash } from './spatialHash.ts'
import { add, limit, scale, setMagnitude, sub, type Vec2 } from './vector.ts'

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
  private readonly boidList: Boid[] = []

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

    this.hash.clear()
    this.boidList.forEach((b, i) => this.hash.insert(i, b.x, b.y))

    const pairs = this.boidList.map((boid, i) => ({
      boid,
      force: this.steerFor(boid, i, { visionRadius, separationRadius, maxSpeed, maxForce }),
    }))

    pairs.forEach(({ boid, force }) => {
      let vx = boid.vx + force.x * dt
      let vy = boid.vy + force.y * dt
      const speed = Math.hypot(vx, vy)
      if (speed > 0) {
        const clamped = Math.min(maxSpeed, Math.max(minSpeed, speed))
        vx = (vx / speed) * clamped
        vy = (vy / speed) * clamped
      }
      boid.vx = vx
      boid.vy = vy
      boid.x = wrap(boid.x + vx * dt, this.width)
      boid.y = wrap(boid.y + vy * dt, this.height)
    })
  }

  private steerFor(
    boid: Boid,
    index: number,
    opts: { visionRadius: number; separationRadius: number; maxSpeed: number; maxForce: number },
  ): Vec2 {
    const velocity: Vec2 = { x: boid.vx, y: boid.vy }
    const neighbours = this.hash
      .queryRadius(boid.x, boid.y, opts.visionRadius)
      .filter((j) => j !== index)

    let separationSum: Vec2 = { x: 0, y: 0 }
    let separationCount = 0
    let velocitySum: Vec2 = { x: 0, y: 0 }
    let positionDeltaSum: Vec2 = { x: 0, y: 0 }
    let flockCount = 0

    for (const j of neighbours) {
      const other = this.boidList[j]
      if (!other) continue
      const dx = wrappedAxisDelta(boid.x, other.x, this.width)
      const dy = wrappedAxisDelta(boid.y, other.y, this.height)
      const dist = Math.hypot(dx, dy)

      flockCount++
      velocitySum = add(velocitySum, { x: other.vx, y: other.vy })
      positionDeltaSum = add(positionDeltaSum, { x: dx, y: dy })

      if (dist > 0 && dist <= opts.separationRadius) {
        separationSum = add(separationSum, scale({ x: dx, y: dy }, -1 / (dist * dist)))
        separationCount++
      }
    }

    const rawSeparation =
      separationCount > 0
        ? sub(setMagnitude(separationSum, opts.maxSpeed), velocity)
        : { x: 0, y: 0 }
    const rawAlignment =
      flockCount > 0
        ? sub(setMagnitude(scale(velocitySum, 1 / flockCount), opts.maxSpeed), velocity)
        : { x: 0, y: 0 }
    const rawCohesion =
      flockCount > 0
        ? sub(setMagnitude(scale(positionDeltaSum, 1 / flockCount), opts.maxSpeed), velocity)
        : { x: 0, y: 0 }

    const separationForce = limit(scale(rawSeparation, this.params.separation), opts.maxForce)
    const alignmentForce = limit(scale(rawAlignment, this.params.alignment), opts.maxForce)
    const cohesionForce = limit(scale(rawCohesion, this.params.cohesion), opts.maxForce)

    return add(add(separationForce, alignmentForce), cohesionForce)
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
