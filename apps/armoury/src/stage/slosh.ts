// The held bottle's liquid sloshing: its surface's tilt from level as a damped pendulum, pushed
// by how fast the bottle turns (ADR 0111). Pure; the stage steps it once a frame.

const DEGREE = Math.PI / 180

/** One swing there and back, seconds. */
export const SLOSH_PERIOD = 0.6
/** The furthest the surface tilts from level; well short of flipping it. */
export const WOBBLE_MAX = 12 * DEGREE
/** Above this the bottle's turn is taken as this fast, rad/s, so a jumpy frame cannot fling the surface. */
export const SPIN_MAX = 5

const DAMPING = 0.3
const W = (2 * Math.PI) / SLOSH_PERIOD / Math.sqrt(1 - DAMPING * DAMPING)
/** The surface's tilt held, radians, per rad/s of steady turn. */
const LAG = 0.045

export interface Slosh {
  /** The surface's turn from level about the up frame's x (its far side up) and z (in the screen plane), radians. */
  x: number
  z: number
  vx: number
  vz: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quat extends Vec3 {
  w: number
}

export const restingSlosh = (): Slosh => ({ x: 0, z: 0, vx: 0, vz: 0 })

const stepped = { x: 0, v: 0 }

/** The exact step of the pendulum towards `rest`, so the slosh is the same at any frame rate. */
function swing(x: number, v: number, rest: number, dt: number): typeof stepped {
  const a = DAMPING * W
  const wd = W * Math.sqrt(1 - DAMPING * DAMPING)
  const decay = Math.exp(-a * dt)
  const c = Math.cos(wd * dt)
  const s = Math.sin(wd * dt)
  const y = x - rest
  stepped.x = rest + decay * (y * c + ((v + a * y) / wd) * s)
  stepped.v = decay * (v * c - ((a * v + W * W * y) / wd) * s)
  return stepped
}

/**
 * Steps `s` in place by `dt` seconds while the bottle turns at `spin` (rad/s, in the up frame): the
 * surface leans against the turn, as the liquid's foot is swung the other way about the hand, and
 * swings back once or twice when the turn stops. Under reduced motion it is level and still.
 */
export function stepSlosh(s: Slosh, spin: Vec3, dt: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    Object.assign(s, restingSlosh())
    return
  }
  const speed = Math.hypot(spin.x, spin.z)
  const k = speed > SPIN_MAX ? SPIN_MAX / speed : 1
  const x = swing(s.x, s.vx, -LAG * spin.x * k, dt)
  s.x = x.x
  s.vx = x.v
  const z = swing(s.z, s.vz, -LAG * spin.z * k, dt)
  s.z = z.x
  s.vz = z.v
}

/** How far the surface tilts from level, radians: the swing eased into `WOBBLE_MAX`, never past it. */
export function wobbleOf(s: Slosh): number {
  const m = Math.hypot(s.x, s.z)
  return WOBBLE_MAX * Math.tanh(m / WOBBLE_MAX)
}

/** The surface's normal in the up frame, +y level, into `out`. */
export function sloshNormal<T extends Vec3>(s: Slosh, out: T): T {
  const m = Math.hypot(s.x, s.z)
  if (m === 0) {
    out.x = 0
    out.y = 1
    out.z = 0
    return out
  }
  const tilt = wobbleOf(s)
  const sin = Math.sin(tilt)
  // Up turned by `tilt` about the axis (x, 0, z) / m.
  out.x = (-s.z / m) * sin
  out.y = Math.cos(tilt)
  out.z = (s.x / m) * sin
  return out
}

/** The turn from `from` to `to` over `dt` seconds as a rate, rad/s, about axes in the frame both are given in, into `out`. */
export function spinBetween<T extends Vec3>(from: Quat, to: Quat, dt: number, out: T): T {
  // to * conj(from), the turn applied on the outside.
  let w = to.w * from.w + to.x * from.x + to.y * from.y + to.z * from.z
  let x = -to.w * from.x + to.x * from.w - to.y * from.z + to.z * from.y
  let y = -to.w * from.y + to.x * from.z + to.y * from.w - to.z * from.x
  let z = -to.w * from.z - to.x * from.y + to.y * from.x + to.z * from.w
  if (w < 0) {
    w = -w
    x = -x
    y = -y
    z = -z
  }
  const half = Math.hypot(x, y, z)
  const scale =
    half < 1e-9 || dt <= 0 ? (dt > 0 ? 2 / dt : 0) : (2 * Math.atan2(half, w)) / half / dt
  out.x = x * scale
  out.y = y * scale
  out.z = z * scale
  return out
}
