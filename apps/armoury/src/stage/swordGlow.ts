import { BLOOM_THRESHOLD } from './stage.ts'
import { REST_CAP, RUNE_REST } from './swordMaterials.ts'
import { EIGHT } from './wave.ts'

/** The sword's flourish is the wand's wave, slowed by this much. */
export const FLOURISH_SCALE = 1.5

/** A thin line of light runs up the edge once, starting as the figure of 8 closes. */
export const GLINT = { from: EIGHT.to * FLOURISH_SCALE, seconds: 0.6 }
const RISE_SECONDS = 0.6
const HOLD_SECONDS = 0.6
const SETTLE_SECONDS = 1.5
const WAKE_SECONDS = RISE_SECONDS + HOLD_SECONDS + SETTLE_SECONDS
/** The gems' catch lasts this share of the glint, from the guard. */
const GEM_CATCH = 0.5

/** The runes' glow (times their colour) at the height of the wake, and the brightest a waking rune or gem may be. */
export const RUNE_PEAK = 1.3 * BLOOM_THRESHOLD
export const WAKE_CAP = 1.4 * BLOOM_THRESHOLD
/** The brightest anything on the sword may ever be: the glint at its height. */
export const GLOW_CEILING = 2 * BLOOM_THRESHOLD
/** Every glint and wake is over by now, however far up the blade the runes sit. */
export const GLOW_SECONDS = GLINT.from + GLINT.seconds + WAKE_SECONDS

export interface SwordGlow {
  /** Where the glint is along the blade, 0 at the guard to 1 at the tip; null when there is none. */
  glintAt: number | null
  /** How bright the glint is, 0 to 1. */
  glint: number
  /** How brightly the runes glow, times their colour. */
  runes: number
  /** How far the wake has spread through the runes from the guard, 0 to 1. */
  wake: number
  /** The brightest a glinting or waking pixel may be; the rest of the sword keeps the rest cap. */
  cap: number
  /** How far the gems are lifted from their rest glow, 0 to 1: a brief catch as the glint leaves the guard, then the wake. */
  gems: number
}

export const SWORD_REST: SwordGlow = {
  glintAt: null,
  glint: 0,
  runes: RUNE_REST,
  wake: 1,
  cap: REST_CAP,
  gems: 0,
}

const smoothstep = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1)
  return x * x * (3 - 2 * x)
}

/**
 * The close look's light `sinceFlourish` seconds into a flourish. `wakeFrom` is where the
 * runes begin along the blade (0 to 1), or null for a sword with nothing to wake.
 */
export function swordGlow(
  sinceFlourish: number,
  reducedMotion: boolean,
  wakeFrom: number | null,
): SwordGlow {
  if (reducedMotion || !(sinceFlourish > 0)) return SWORD_REST

  const u = (sinceFlourish - GLINT.from) / GLINT.seconds
  const glinting = u >= 0 && u <= 1
  const glint = glinting ? Math.sin(Math.PI * u) : 0
  const caught = u >= 0 && u <= GEM_CATCH ? Math.sin((Math.PI * u) / GEM_CATCH) : 0

  let lift = 0
  let wake = 1
  if (wakeFrom !== null) {
    const w = sinceFlourish - (GLINT.from + wakeFrom * GLINT.seconds)
    if (w > 0 && w < WAKE_SECONDS) {
      lift =
        w < RISE_SECONDS + HOLD_SECONDS
          ? smoothstep(w / RISE_SECONDS)
          : 1 - smoothstep((w - RISE_SECONDS - HOLD_SECONDS) / SETTLE_SECONDS)
      wake = Math.min(w / RISE_SECONDS, 1)
    }
  }

  if (!glinting && lift === 0) return SWORD_REST
  return {
    glintAt: glinting ? u : null,
    glint,
    runes: RUNE_REST + (RUNE_PEAK - RUNE_REST) * lift,
    wake,
    cap: Math.max(
      REST_CAP + (GLOW_CEILING - REST_CAP) * glint,
      REST_CAP + (WAKE_CAP - REST_CAP) * lift,
    ),
    gems: Math.max(caught, lift),
  }
}

/** How far the wake has lifted the runes and gems from rest toward their peak, 0 to 1. */
export const wakeLift = (glow: SwordGlow) => (glow.runes - RUNE_REST) / (RUNE_PEAK - RUNE_REST)

const PRESENT = {
  from: GLINT.from - 0.75,
  held: GLINT.from,
  until: GLINT.from + GLINT.seconds + RISE_SECONDS + HOLD_SECONDS,
  release: 0.8,
}

/** How firmly the close look turns the blade's flat to the viewer, 0 to 1, so the glint and the waking runes are seen. */
export function presentWeight(sinceFlourish: number, reducedMotion: boolean): number {
  if (reducedMotion || !(sinceFlourish > PRESENT.from)) return 0
  if (sinceFlourish < PRESENT.held)
    return smoothstep((sinceFlourish - PRESENT.from) / (PRESENT.held - PRESENT.from))
  return 1 - smoothstep((sinceFlourish - PRESENT.until) / PRESENT.release)
}
