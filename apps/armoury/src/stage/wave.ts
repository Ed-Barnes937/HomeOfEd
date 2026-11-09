import * as THREE from 'three'

import { WAVE_TO_SPELL_SECONDS } from './stage.ts'

// The wand aims away into the scene, draws one slow figure of 8 there, and the
// spell leaves the tip as the 8 closes. Then the wand settles back.
const AIM_SECONDS = 0.5
const EIGHT_SECONDS = WAVE_TO_SPELL_SECONDS - AIM_SECONDS
const SETTLE_SECONDS = 0.7

export const EIGHT = { from: AIM_SECONDS, to: WAVE_TO_SPELL_SECONDS }
export const WAVE_SECONDS = EIGHT.to + SETTLE_SECONDS

/** Radians, about the grip, at full size. */
const TURN = { away: 0.8, side: 0.6, rise: 0.22 }

export interface WavePose {
  /** 0 held as the child left it, 1 aimed away from the viewer. */
  aim: number
  /** Where the tip is across the 8, from -1 to 1, side to side and up and down. */
  side: number
  rise: number
  /** Whether the tip leaves a streak of light. */
  trail: boolean
}

const ease = (t: number) => (1 - Math.cos(Math.PI * Math.min(Math.max(t, 0), 1))) / 2

/** The wand `seconds` into a wave. */
export function wavePose(seconds: number): WavePose {
  if (seconds < EIGHT.from)
    return { aim: ease(seconds / AIM_SECONDS), side: 0, rise: 0, trail: false }
  if (seconds < EIGHT.to) {
    const phi = 2 * Math.PI * ease((seconds - EIGHT.from) / EIGHT_SECONDS)
    return { aim: 1, side: Math.sin(phi), rise: Math.sin(2 * phi), trail: true }
  }
  return { aim: 1 - ease((seconds - EIGHT.to) / SETTLE_SECONDS), side: 0, rise: 0, trail: false }
}

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const step = new THREE.Quaternion()

/**
 * The turn about the grip for `pose`: away from the viewer about `across` (the
 * screen axis across the held wand), then the 8 about the screen's own axes so
 * it reads as side to side however the wand is held. `size` scales the 8.
 */
export function waveTurn(
  pose: WavePose,
  across: THREE.Vector3,
  size: number,
  out: THREE.Quaternion,
): THREE.Quaternion {
  return out
    .setFromAxisAngle(across, TURN.away * pose.aim)
    .premultiply(step.setFromAxisAngle(X, TURN.rise * size * pose.rise))
    .premultiply(step.setFromAxisAngle(Y, TURN.side * size * pose.side))
}

/** Where the tip may go, in normalised device coordinates: clear of the header and the caption. */
const FRAME = { x: 0.88, top: 0.78, bottom: -0.4 }
const SMALLEST = 0.35
const turn = new THREE.Quaternion()
const point = new THREE.Vector3()

/**
 * The biggest 8, up to full size, whose tip stays on screen, for a wand held
 * at `grip` (world) with its tip `reach` from there.
 */
export function fitWave(
  camera: THREE.Camera,
  grip: THREE.Vector3,
  reach: THREE.Vector3,
  across: THREE.Vector3,
): number {
  const fits = (size: number) => {
    for (let i = 0; i < 24; i++) {
      const phi = (2 * Math.PI * i) / 24
      waveTurn(
        { aim: 1, side: Math.sin(phi), rise: Math.sin(2 * phi), trail: true },
        across,
        size,
        turn,
      )
      const p = point.copy(reach).applyQuaternion(turn).add(grip).project(camera)
      if (Math.abs(p.x) > FRAME.x || p.y > FRAME.top || p.y < FRAME.bottom) return false
    }
    return true
  }
  if (fits(1)) return 1
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return Math.max(lo, SMALLEST)
}
