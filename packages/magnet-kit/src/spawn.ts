import type { Placement, Size } from './types.ts'

/**
 * Where a freshly-added magnet should appear: near the top-centre of the door
 * with a little jitter and tilt. Returns UNCLAMPED coordinates — callers must
 * run relax() (which clamps) right after spawning. `rng` is injected so tests
 * are deterministic (Math.random in the app).
 */
export function spawnPlacement(
  boundsW: number,
  boundsH: number,
  size: Size,
  rng: () => number,
): Placement {
  return {
    x: boundsW / 2 - size.w / 2 + (rng() - 0.5) * 90, // centre ± up to 45px
    y: boundsH * 0.16 + rng() * 46,
    rot: rng() * 14 - 7, // ± up to 7°
  }
}
