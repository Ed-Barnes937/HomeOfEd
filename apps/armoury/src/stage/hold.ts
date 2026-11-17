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
  return (knee + SOFT * (1 - Math.exp(-(raw + delta * sign) / SOFT))) * sign
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

const stepped = { x: 0, v: 0 }

/** The exact step of a spring towards 0, damped by `DAMPING` or critically, so the wobble is the same at any frame rate. */
function spring(x: number, v: number, dt: number, critical: boolean): typeof stepped {
  const w = STIFFNESS
  const damping = critical ? 1 : DAMPING
  const decay = Math.exp(-damping * w * dt)
  if (critical) {
    const k = v + w * x
    stepped.x = (x + k * dt) * decay
    stepped.v = (v - w * k * dt) * decay
    return stepped
  }
  const a = damping * w
  const wd = w * Math.sqrt(1 - damping * damping)
  const c = Math.cos(wd * dt)
  const s = Math.sin(wd * dt)
  stepped.x = decay * (x * c + ((v + a * x) / wd) * s)
  stepped.v = decay * (v * c - ((a * v + w * w * x) / wd) * s)
  return stepped
}

/** Lets go of the item for `dt` seconds, stepping `pose` in place: it swings back to upright, without a wobble under reduced motion. */
export function rightUpright(pose: UprightPose, dt: number, reducedMotion: boolean): void {
  const lean = spring(pose.lean, pose.leanVelocity, dt, reducedMotion)
  pose.lean = lean.x
  pose.leanVelocity = lean.v
  const tip = spring(pose.tip, pose.tipVelocity, dt, reducedMotion)
  pose.tip = tip.x
  pose.tipVelocity = tip.v
}

/** An item's outline seen from the front, mm: x across and y up from its foot. */
export type Outline = readonly (readonly [x: number, y: number])[]

/** The room an upright item leaves each side of a portrait screen, leaned to the limit, as a fraction of its width. */
export const LEAN_MARGIN = 0.04
const SWEEP_STEP = 1 * DEGREE

const span = { min: 0, max: 0 }

/** Where `outline` reaches across the screen, mm from its axis, leaned by `lean` about the point on its axis `pivotMm` above the foot. */
function leanedSpan(outline: Outline, pivotMm: number, lean: number): typeof span {
  const c = Math.cos(lean)
  const s = Math.sin(lean)
  span.min = Infinity
  span.max = -Infinity
  for (const [x, y] of outline) {
    const across = x * c + (y - pivotMm) * s
    span.min = Math.min(span.min, across)
    span.max = Math.max(span.max, across)
  }
  return span
}

/** The widest `outline` spans across the screen at any lean up to `LEAN_MAX` either way, mm. */
export function sweptWidthMm(outline: Outline, pivotMm: number): number {
  let widest = 0
  for (let lean = -LEAN_MAX; lean < LEAN_MAX + SWEEP_STEP / 2; lean += SWEEP_STEP) {
    const { min, max } = leanedSpan(outline, pivotMm, Math.min(lean, LEAN_MAX))
    widest = Math.max(widest, max - min)
  }
  return widest
}

/** The most pixels per mm an upright item fits a portrait screen at, its outline leaned to the limit either way and centred. */
export function leanFit(sweptMm: number, screenWidthPx: number): number {
  return ((1 - 2 * LEAN_MARGIN) * screenWidthPx) / sweptMm
}

/** How far across to move the item, mm, so its outline leaned by `lean` is centred where its axis stood. */
export function leanShiftMm(outline: Outline, pivotMm: number, lean: number): number {
  if (lean === 0) return 0
  const { min, max } = leanedSpan(outline, pivotMm, lean)
  return -(min + max) / 2
}

const EASE_SECONDS = 0.3
const smoothstep = (t: number) => {
  const u = Math.min(Math.max(t, 0), 1)
  return u * u * (3 - 2 * u)
}

/**
 * From 0 to 1, how strongly the item's own flourish holds it upright, `sinceFlourish` seconds in;
 * under reduced motion a step, with no ease. A drag lets it go: `back` is the moment in the
 * flourish it comes back from, Infinity while a finger holds the item (ADR 0111).
 */
export function uprightFlourishWeight(
  sinceFlourish: number,
  flourishSeconds: number,
  reducedMotion: boolean,
  back = 0,
): number {
  if (!(sinceFlourish >= 0 && sinceFlourish < flourishSeconds && sinceFlourish >= back)) return 0
  if (reducedMotion) return 1
  return Math.min(
    smoothstep((sinceFlourish - back) / EASE_SECONDS),
    smoothstep((flourishSeconds - sinceFlourish) / EASE_SECONDS),
  )
}

/** The pose a drag starts from when it takes the item from a flourish holding it upright by `weight`: the pose as drawn. */
export function takeFromHold(pose: UprightPose, weight: number): UprightPose {
  return {
    lean: pose.lean * (1 - weight),
    tip: pose.tip * (1 - weight),
    leanVelocity: 0,
    tipVelocity: 0,
  }
}

/** An upright item's pose, and the moment of its flourish the hold comes back from (Infinity while a finger holds it). */
export interface HeldUpright {
  upright: UprightPose
  holdBack: number
}

export type HoldChange =
  /** A flourish starts; taken at once if a drag is moving the item. */
  | { kind: 'flourish'; dragging: boolean }
  /** A drag past the tap slop moves the item; `weight` is how strongly the hold held it as drawn. */
  | { kind: 'drag'; dx: number; dy: number; weight: number }
  /** The last finger lets go, `since` seconds into the flourish. */
  | { kind: 'release'; since: number }

/** How the hold and a finger hand an upright item over to each other (ADR 0111). */
export function holdOn(held: HeldUpright, change: HoldChange): HeldUpright {
  switch (change.kind) {
    case 'flourish':
      return { upright: held.upright, holdBack: change.dragging ? Infinity : 0 }
    case 'drag': {
      const from =
        held.holdBack === Infinity ? held.upright : takeFromHold(held.upright, change.weight)
      return { upright: dragUpright(from, change.dx, change.dy), holdBack: Infinity }
    }
    case 'release':
      return held.holdBack === Infinity ? { upright: held.upright, holdBack: change.since } : held
  }
}
