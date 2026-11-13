// How the close look holds an item: level like a wand and a sword, or upright like a bottle,
// which a child leans and tips and which rights itself when let go (ADR 0105).

export type Hold = 'level' | 'upright'

const DEGREE = Math.PI / 180

/** The furthest an upright item leans sideways in the screen plane. */
export const LEAN_MAX = 60 * DEGREE
/** The furthest an upright item's top tips towards or away from the viewer. */
export const TIP_MAX = 45 * DEGREE
/** Over its last stretch before either limit, a drag moves the item less and less. */
const SOFT = 10 * DEGREE
export const UPRIGHT_PER_PX = 0.007

/** About 0.8 s to settle; damped enough for one visible overshoot of about 16 percent. */
const STIFFNESS = 8
const DAMPING = 0.5

/** How far the held item turns from level on screen, about the view axis. */
export function heldTilt(hold: Hold, portrait: boolean): number {
  if (hold === 'upright') return Math.PI / 2
  return portrait ? Math.PI * 0.4 : Math.PI * 0.05
}

export interface UprightPose {
  /** Radians in the screen plane; positive leans the top to the right. */
  lean: number
  /** Radians about the screen's x; positive tips the top towards the viewer. */
  tip: number
  leanVelocity: number
  tipVelocity: number
}

/** Moves `angle` by `delta`, giving way softly as it nears `max` and stopping there. */
function soften(angle: number, delta: number, max: number): number {
  const sign = Math.sign(delta)
  const knee = max - SOFT
  const from = angle * sign
  if (sign === 0 || from + delta * sign <= knee) return angle + delta
  // Past the knee the angle is `knee + SOFT * (1 - e^(-r / SOFT))` of a raw drag `r` beyond it.
  const raw = from <= knee ? from - knee : -SOFT * Math.log(Math.max(1 - (from - knee) / SOFT, 0))
  const to = knee + SOFT * (1 - Math.exp(-(raw + delta * sign) / SOFT))
  return Math.min(to, max) * sign
}

/** A drag across leans the item; a drag along (down the screen) tips its top towards the viewer. */
export function dragUpright(pose: UprightPose, dxPx: number, dyPx: number): UprightPose {
  return {
    lean: soften(pose.lean, dxPx * UPRIGHT_PER_PX, LEAN_MAX),
    tip: soften(pose.tip, dyPx * UPRIGHT_PER_PX, TIP_MAX),
    leanVelocity: 0,
    tipVelocity: 0,
  }
}

/** The exact step of a damped spring towards 0, so the wobble is the same at any frame rate. */
function spring(x: number, v: number, dt: number, damping: number): [number, number] {
  const w = STIFFNESS
  const decay = Math.exp(-damping * w * dt)
  if (damping >= 1) {
    const k = v + w * x
    return [(x + k * dt) * decay, (v - w * k * dt) * decay]
  }
  const a = damping * w
  const wd = w * Math.sqrt(1 - damping * damping)
  const c = Math.cos(wd * dt)
  const s = Math.sin(wd * dt)
  return [
    decay * (x * c + ((v + a * x) / wd) * s),
    decay * (v * c - ((a * v + w * w * x) / wd) * s),
  ]
}

/** Lets go of the item for `dt` seconds: it swings back to upright, without a wobble under reduced motion. */
export function rightUpright(pose: UprightPose, dt: number, reducedMotion: boolean): UprightPose {
  const damping = reducedMotion ? 1 : DAMPING
  const [lean, leanVelocity] = spring(pose.lean, pose.leanVelocity, dt, damping)
  const [tip, tipVelocity] = spring(pose.tip, pose.tipVelocity, dt, damping)
  return { lean, tip, leanVelocity, tipVelocity }
}

const EASE_SECONDS = 0.3
const smoothstep = (t: number) => {
  const u = Math.min(Math.max(t, 0), 1)
  return u * u * (3 - 2 * u)
}

/** From 0 to 1, how strongly the item's own flourish holds it upright, `sinceFlourish` seconds in. */
export function uprightFlourishWeight(sinceFlourish: number, flourishSeconds: number): number {
  if (!(sinceFlourish >= 0 && sinceFlourish < flourishSeconds)) return 0
  return Math.min(
    smoothstep(sinceFlourish / EASE_SECONDS),
    smoothstep((flourishSeconds - sinceFlourish) / EASE_SECONDS),
  )
}
