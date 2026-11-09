import { BLOOM_THRESHOLD, SPELL_SECONDS } from './stage.ts'

/** How brightly gems glow (times the core's colour) and the brightest any of their light may be. */
export interface GemGlow {
  emissive: number
  cap: number
}

/** At rest gems keep under the same cap as the rest of the wand, so they glow without blooming. */
export const GEM_REST: GemGlow = { emissive: 0.45, cap: 0.92 * BLOOM_THRESHOLD }
const FLARE: GemGlow = { emissive: 8, cap: 14 }

/** Gems flare with the spell and fade with it; with reduced motion they hold a steady glow. */
export function gemGlow(sinceCast: number, reducedMotion: boolean): GemGlow {
  if (reducedMotion || !(sinceCast >= 0 && sinceCast < SPELL_SECONDS)) return GEM_REST
  const flare = Math.exp(-3 * sinceCast)
  return {
    emissive: GEM_REST.emissive + (FLARE.emissive - GEM_REST.emissive) * flare,
    cap: GEM_REST.cap + (FLARE.cap - GEM_REST.cap) * flare,
  }
}
