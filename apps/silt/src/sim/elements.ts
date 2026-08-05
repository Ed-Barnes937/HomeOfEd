import type { ElementDef } from './types.ts'

/**
 * **Pinned species ids** — these bytes land in localStorage scenes, so they are
 * never renumbered. The full v1 roster is reserved up front even though only
 * dirt and sand are registered so far (water/lava/obsidian arrive with the
 * liquid archetype in ticket 06); reserving them keeps later tickets from
 * shifting ids under saved scenes.
 */
export const EMPTY = 0
export const DIRT = 1
export const SAND = 2
export const WATER = 3
export const LAVA = 4
export const OBSIDIAN = 5

/**
 * Out-of-bounds sentinel. Reads past the edge return this, so no element ever
 * branches on edges — the world behaves as if walled.
 */
export const WALL = 255

const dirt: ElementDef = {
  id: DIRT,
  name: 'dirt',
  colours: ['#8a7358'],
  tags: ['solid'],
  archetype: { kind: 'static' },
}

const sand: ElementDef = {
  id: SAND,
  name: 'sand',
  colours: ['#d9b978'],
  tags: ['powder'],
  // slide 1 = always tries a diagonal when blocked below, the classic
  // falling-sand angle of repose. Density orders displacement against the
  // liquids landing in ticket 06.
  archetype: { kind: 'powder', density: 60, slide: 1 },
}

/** Everything registered so far. Pure config — zero behavioural code. */
export const v1Elements: readonly ElementDef[] = [dirt, sand]
