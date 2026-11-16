// What comes out of the neck when the cork pops (ADR 0111, "The uncorking"): seven programs of
// one particle system, each a pure function of the seconds since the pop, and where the stage
// puts a particle in its frame. Three-free; `EffectShow.tsx` draws what these return.

import type { PotionEffect } from '../potion/effects.ts'

type Kind = PotionEffect['kind']

/** From the pop to the stopper setting off back. */
export const EFFECT_SECONDS = 2.5
/** The moment of the show that reduced motion holds still. */
export const EFFECT_STILL_AGE = 1.2
export const MAX_POINTS = 300
export const MAX_SMOKE = 6
/** The widest sprite, CSS px on a phone 844 px tall; a particle's `size` is a share of it. */
export const MAX_SPRITE_PX = 64

/** The box a program keeps to, in the neck's frame: x across the screen, y up, z towards the viewer. */
export const EFFECT_BOX = { side: 1, up: 1, down: 0.25, depth: 1 } as const

export const SHAPES = {
  bubble: 1,
  glitter: 2,
  star: 3,
  mote: 4,
  ribbon: 5,
  smoke: 6,
  wisp: 7,
  blob: 8,
  droplet: 9,
} as const

export interface Particle {
  x: number
  y: number
  z: number
  /** Its width as a share of the widest sprite, 0 to 1. */
  size: number
  alpha: number
  shape: number
  /** Which of the effect's colours it takes, cycled. */
  tint: number
  /** A bubble's squash, a sparkle's or a star's turn. */
  warp: number
  /** It has left the neck: from then it keeps the place the neck had. */
  born: boolean
}

export const newParticle = (): Particle => ({
  x: 0,
  y: 0,
  z: 0,
  size: 0,
  alpha: 0,
  shape: 0,
  tint: 0,
  warp: 0,
  born: false,
})

const TAU = 2 * Math.PI
const smoothstep = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  return x * x * (3 - 2 * x)
}
/** Eases from 0 towards 1, fast at first. */
const settle = (t: number, rate: number) => 1 - Math.exp(-rate * t)

/** A number in 0 to 1 for particle `i`'s `k`th choice. */
function pick(seed: number, i: number, k: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A seed for a recipe's own arrangement. */
export function effectSeed(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return h >>> 0
}

type Counts = readonly [number, number, number]
const WHIFFY_SMOKE: Counts = [4, 5, 6]
const COUNTS: Record<Kind, Counts> = {
  floating: [7, 11, 15],
  sparkling: [110, 190, 280],
  dreamy: [6, 9, 12],
  glowing: [14, 22, 30],
  whirling: [120, 200, 280],
  whiffy: [9, 13, 17],
  murky: [8, 8, 8],
}
const WHIRL_SPAN: Counts = [0.75, 1, 1.25]
const MURKY_POP = 1.7

const by = (counts: Counts, strength: number) =>
  counts[Math.min(Math.max(Math.round(strength), 1), 3) - 1]!

export const effectCount = (kind: Kind, strength: number) => by(COUNTS[kind], strength)

type Program = (seed: number, i: number, age: number, strength: number, p: Particle) => void

const floating: Program = (seed, i, age, strength, p) => {
  const delay = (i / by(COUNTS.floating, strength)) * 0.95
  const t = age - delay
  if (t < 0) return
  p.born = true
  const drift = settle(t, 1)
  const wobble = TAU * pick(seed, i, 3)
  p.x =
    (i % 2 ? 1 : -1) * (0.15 + 0.7 * pick(seed, i, 1)) * drift +
    0.035 * Math.sin(2.4 * t + wobble) * Math.min(2 * t, 1)
  p.y = (0.5 + 0.45 * pick(seed, i, 2)) * settle(t, 1.5)
  p.z = (2 * pick(seed, i, 4) - 1) * 0.8 * drift
  const popAt = Math.min(1 + 0.9 * pick(seed, i, 6), EFFECT_SECONDS - 0.35 - delay)
  const popping = smoothstep((t - popAt) / 0.1)
  p.size =
    (0.36 + 0.4 * pick(seed, i, 5)) * (0.35 + 0.65 * smoothstep(t / 0.4)) * (1 + 0.2 * popping)
  p.alpha = smoothstep(t / 0.08) * (1 - popping)
  p.warp = 0.1 * Math.sin(5.5 * t + wobble)
  p.shape = SHAPES.bubble
  p.tint = i
}

const sparkling: Program = (seed, i, age, _strength, p) => {
  const delay = i === 0 ? 0 : pick(seed, i, 0) ** 1.6 * 1.15
  const t = age - delay
  if (t < 0) return
  p.born = true
  const height = 0.5 + 0.47 * pick(seed, i, 1)
  const apex = 0.4 + 0.14 * pick(seed, i, 2)
  const life = 2.1 * apex
  const u = Math.min(t, life)
  const fall = (2 * height) / (apex * apex)
  p.x = (2 * pick(seed, i, 3) - 1) * 0.92 * (u / life)
  p.y = fall * u * (apex - 0.5 * u)
  p.z = (2 * pick(seed, i, 4) - 1) * 0.9 * (u / life)
  const twinkle = TAU * pick(seed, i, 5)
  p.size = 0.16 + 0.18 * pick(seed, i, 6)
  p.alpha =
    smoothstep(t / 0.04) *
    (1 - smoothstep((t - 0.7 * life) / (0.3 * life))) *
    (0.55 + 0.45 * Math.sin(22 * t + twinkle))
  p.warp = twinkle + 2 * t
  p.shape = SHAPES.glitter
  p.tint = i
}

const dreamy: Program = (seed, i, age, strength, p) => {
  const delay = (i / by(COUNTS.dreamy, strength)) * 0.75
  const t = age - delay
  if (t < 0) return
  p.born = true
  const sway = TAU * pick(seed, i, 3)
  const drift = settle(t, 0.9)
  p.x =
    (i % 2 ? -1 : 1) * (0.12 + 0.72 * pick(seed, i, 1)) * drift +
    0.05 * Math.sin(1.4 * t + sway) * Math.min(t, 1)
  p.y = (0.45 + 0.5 * pick(seed, i, 2)) * settle(t, 1.1)
  p.z = (2 * pick(seed, i, 4) - 1) * 0.7 * drift
  p.size = (0.5 + 0.3 * pick(seed, i, 5)) * (0.5 + 0.5 * smoothstep(t / 0.5))
  const fadeFrom = EFFECT_SECONDS - 1 - delay
  p.alpha =
    smoothstep(t / 0.35) *
    (0.7 + 0.3 * Math.sin(3.4 * t + TAU * pick(seed, i, 6))) *
    (1 - smoothstep((t - fadeFrom) / 0.7))
  p.warp = 0.35 * Math.sin(0.9 * t + sway)
  p.shape = SHAPES.star
  p.tint = i
}

const glowing: Program = (seed, i, age, _strength, p) => {
  const delay = i === 0 ? 0 : pick(seed, i, 0) * 0.55
  const t = age - delay
  if (t < 0) return
  p.born = true
  const round = TAU * pick(seed, i, 2) + 5.5 * settle(t, 1.5)
  const out = (0.3 + 0.6 * pick(seed, i, 1)) * settle(t, 2)
  const hover = Math.min(t, 1)
  p.x = 0.93 * out * Math.cos(round) + 0.03 * Math.sin(1.9 * t + TAU * pick(seed, i, 5)) * hover
  p.y =
    (0.22 + 0.68 * pick(seed, i, 3)) * settle(t, 1.7) +
    0.035 * Math.sin(2.3 * t + TAU * pick(seed, i, 6)) * hover
  p.z = out * Math.sin(round)
  p.size = 0.4 + 0.22 * pick(seed, i, 4)
  const pulse = Math.sin(1.4 * t + TAU * pick(seed, i, 7))
  const fadeFrom = EFFECT_SECONDS - 0.75 - delay
  p.alpha =
    smoothstep(t / 0.12) * (0.55 + 0.45 * pulse * pulse) * (1 - smoothstep((t - fadeFrom) / 0.5))
  p.shape = SHAPES.mote
  p.tint = i
}

const whirling: Program = (seed, i, age, strength, p) => {
  const along = i / (by(COUNTS.whirling, strength) - 1)
  const t = age - along * by(WHIRL_SPAN, strength)
  if (t < 0) return
  p.born = true
  const up = settle(t, 1.3)
  const round = TAU * pick(seed, 0, 9) + 12 * settle(t, 1)
  const out = 0.1 + 0.72 * up ** 0.85
  p.x = out * Math.cos(round) + 0.03 * (pick(seed, i, 1) - 0.5)
  p.y = 0.94 * up + 0.03 * (pick(seed, i, 2) - 0.5) * Math.min(4 * t, 1)
  p.z = out * Math.sin(round)
  p.size = 0.24 + 0.08 * pick(seed, i, 3)
  p.alpha = 0.9 * smoothstep(t / 0.1) * (1 - smoothstep((t - 0.6) / 0.55))
  p.shape = SHAPES.ribbon
  p.tint = Math.floor(along * 9)
}

const whiffy: Program = (seed, i, age, strength, p) => {
  const puffs = by(WHIFFY_SMOKE, strength)
  if (i < puffs) {
    const t = age - 0.03 * i
    if (t < 0) return
    p.born = true
    const swell = settle(t, 2.2)
    const round = TAU * ((i + 0.7 * pick(seed, i, 6)) / (puffs - 1) + pick(seed, 0, 9))
    const off = i === 0 ? 0 : (0.1 + 0.1 * pick(seed, i, 7)) * swell
    p.x = 0.05 * Math.sin(1.3 * t) + off * Math.cos(round)
    p.y = 0.26 * settle(t, 2.5) + 0.06 * t + off * Math.sin(round)
    p.z = 0.3 * Math.sin(2 * round)
    p.size = (i === 0 ? 1 : 0.6 + 0.3 * pick(seed, i, 5)) * (0.45 + 0.55 * swell)
    p.alpha = smoothstep(t / 0.15) * (1 - smoothstep((t - 1.2) / 0.9))
    p.shape = SHAPES.smoke
    p.tint = i
    return
  }
  const t = age - 0.25 - 0.9 * pick(seed, i, 0)
  if (t < 0) return
  p.born = true
  p.x =
    0.2 * (pick(seed, i, 1) - 0.5) +
    0.22 * Math.sin(2.6 * t + TAU * pick(seed, i, 2)) * Math.min(1.5 * t, 1)
  p.y = 0.3 * settle(t, 6) + 0.55 * settle(t, 1.1)
  p.z = 0.5 * (pick(seed, i, 3) - 0.5)
  p.size = 0.16 + 0.14 * pick(seed, i, 4)
  p.alpha = 0.7 * smoothstep(t / 0.2) * (1 - smoothstep((t - 0.5) / 0.6))
  p.shape = SHAPES.wisp
  p.tint = i
}

const murkyBubble = (t: number, p: Particle) => {
  const grow = smoothstep(t / 0.6)
  const rise = smoothstep((t - 0.5) / 1)
  p.x = 0.07 * Math.sin(2.2 * t) * rise
  p.y = 0.2 * grow + 0.34 * rise
  p.size = 0.3 + 0.55 * grow + 0.15 * rise
  p.warp = 0.26 * Math.sin(12 * t) * Math.exp(-2.2 * t) + 0.07 * Math.sin(4.4 * t) * rise
}

const murky: Program = (seed, i, age, _strength, p) => {
  p.born = true
  if (i === 0) {
    murkyBubble(age, p)
    p.alpha = smoothstep(age / 0.06) * (1 - smoothstep((age - MURKY_POP) / 0.07))
    p.shape = SHAPES.blob
    return
  }
  const u = age - MURKY_POP
  if (u < 0) return
  murkyBubble(MURKY_POP, p)
  const way = TAU * ((i - 1) / 7) + 0.5 * (pick(seed, i, 1) - 0.5)
  const reach = (0.2 + 0.12 * pick(seed, i, 2)) * settle(u, 5)
  p.x += 0.75 * Math.cos(way) * reach
  p.y += Math.sin(way) * reach - 0.8 * u * u
  p.z = 0.3 * Math.cos(2 * way)
  p.size = 0.1 + 0.07 * pick(seed, i, 3)
  p.alpha = 1 - smoothstep((u - 0.2) / 0.3)
  p.warp = 0
  p.shape = SHAPES.droplet
}

const PROGRAMS: Record<Kind, Program> = {
  floating,
  sparkling,
  dreamy,
  glowing,
  whirling,
  whiffy,
  murky,
}

/** Particle `i` of an effect, `age` seconds after the pop, written into `out`: in the box, and gone by the end. */
export function effectParticle(
  kind: Kind,
  seed: number,
  i: number,
  age: number,
  strength: number,
  out: Particle,
): Particle {
  out.x = 0
  out.y = 0
  out.z = 0
  out.size = 0
  out.alpha = 0
  out.shape = 0
  out.tint = 0
  out.warp = 0
  out.born = false
  if (!(age >= 0)) return out
  PROGRAMS[kind](seed, i, Math.min(age, EFFECT_SECONDS), strength, out)
  out.alpha *= 1 - smoothstep((age - (EFFECT_SECONDS - 0.3)) / 0.25)
  return out
}

/** The edges of what the camera sees on the neck's plane, about its centre. */
export interface Frame {
  left: number
  right: number
  top: number
}

/** How far an effect reaches from the neck each way. */
export interface Reach {
  left: number
  right: number
  up: number
}

/** The box's reach, in bottle heights, where the frame has the room. */
export const REACH = { side: 0.46, up: 0.42 } as const
/** Kept clear at the frame's edges, as a share of its height. */
const EDGE = 0.012

const edge = (frame: Frame) => 2 * EDGE * frame.top
/** A side with less than this share of the other side's room is not used. */
const FOLD = 0.4

/** The effect's reach from a neck at (x, y): by the bottle's height, and no further than the frame. */
export function effectReach(x: number, y: number, frame: Frame, bottle: number, out: Reach): Reach {
  const m = edge(frame)
  out.left = Math.max(0, Math.min(REACH.side * bottle, x - frame.left - m))
  out.right = Math.max(0, Math.min(REACH.side * bottle, frame.right - x - m))
  out.up = Math.max(0, Math.min(REACH.up * bottle, frame.top - y - m))
  return out
}

/**
 * Where a particle is drawn on the neck's plane, from the place the neck had when it left: its
 * whole sprite, `radius` across the half, inside its reach and inside the frame.
 */
export function placeParticle(
  p: Particle,
  x: number,
  y: number,
  reach: Reach,
  frame: Frame,
  radius: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const m = edge(frame)
  const near = p.x < 0 ? reach.left : reach.right
  const far = p.x < 0 ? reach.right : reach.left
  // A side with little room sends its particles out the other way, not squeezed against the edge.
  const folded = near < FOLD * far
  const lo = frame.left + radius + m
  const hi = frame.right - radius - m
  const px = x + (folded ? -p.x : p.x) * Math.max((folded ? far : near) - radius, 0)
  out.x = lo > hi ? (frame.left + frame.right) / 2 : Math.min(Math.max(px, lo), hi)
  out.y = Math.min(y + p.y * Math.max(reach.up - radius, 0), frame.top - radius - m)
  return out
}
