import { describe, expect, it } from 'vitest'

import {
  ACID,
  createRegistry,
  DIRT,
  FIRE,
  LAVA,
  MUD,
  OIL,
  SAND,
  SEED,
  STONE,
  WATER,
  WOOD,
  type ElementDef,
} from '../../sim/index.ts'
import { buildSpeciesPalette, paletteSlot } from '../render/speciesPalette.ts'
import { buildRailPalette } from './paletteGroups.ts'

function hexToRgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * Ticket 16: the rail and the canvas must read colours off the same
 * registry, so a sim built with a non-default roster cannot show one set of
 * colours in the rail and another on the canvas. This roster's colours are
 * deliberately not the v1 defaults, so a rail derived from `v1Elements`
 * instead of this registry would fail.
 */
describe('rail and grid colours share one registry', () => {
  it('draws identical colours from a non-default roster', () => {
    const nonDefaultRoster: readonly ElementDef[] = [
      { id: DIRT, name: 'dirt', colours: ['#123456'], tags: ['solid'], archetype: { kind: 'static' } },
      {
        id: SAND,
        name: 'sand',
        colours: ['#abcdef'],
        tags: ['powder'],
        archetype: { kind: 'powder', density: 60, slide: 1 },
      },
      {
        id: WATER,
        name: 'water',
        colours: ['#0f0f0f'],
        tags: ['liquid'],
        archetype: { kind: 'liquid', density: 30, dispersion: 5 },
      },
      {
        id: LAVA,
        name: 'lava',
        colours: ['#ff00ff'],
        tags: ['liquid'],
        archetype: { kind: 'liquid', density: 45, dispersion: 2, move: 0.15 },
      },
      { id: WOOD, name: 'wood', colours: ['#010203'], tags: ['solid'], archetype: { kind: 'static' } },
      {
        id: OIL,
        name: 'oil',
        colours: ['#040506'],
        tags: ['liquid'],
        archetype: { kind: 'liquid', density: 20, dispersion: 4 },
      },
      {
        id: FIRE,
        name: 'fire',
        colours: ['#070809'],
        tags: ['energy'],
        archetype: { kind: 'gas', density: -20, dispersion: 1 },
      },
      {
        id: ACID,
        name: 'acid',
        colours: ['#0a0b0c'],
        tags: ['liquid'],
        archetype: { kind: 'liquid', density: 35, dispersion: 4 },
      },
      {
        id: STONE,
        name: 'stone',
        colours: ['#0d0e0f'],
        tags: ['solid'],
        archetype: { kind: 'static' },
      },
      {
        id: MUD,
        name: 'mud',
        colours: ['#101112'],
        tags: ['liquid'],
        archetype: { kind: 'liquid', density: 50, dispersion: 1, move: 0.1 },
      },
      {
        id: SEED,
        name: 'seed',
        colours: ['#131415'],
        tags: ['powder'],
        archetype: { kind: 'powder', density: 40, slide: 1 },
      },
    ]
    const registry = createRegistry(nonDefaultRoster)

    const railPalette = buildRailPalette(registry)
    const speciesPalette = buildSpeciesPalette(registry)

    expect(railPalette.colourOf(DIRT)).toBe('#123456')

    for (const entry of railPalette.entries) {
      const [r, g, b] = hexToRgb(entry.colour)
      // The rail shows `colours[0]`, which the grid palette keeps in variant
      // slot 0 — that is what stops a shaded roster drifting from its swatches.
      const offset = paletteSlot(entry.id, 0) * 3
      expect([speciesPalette[offset], speciesPalette[offset + 1], speciesPalette[offset + 2]]).toEqual([
        r,
        g,
        b,
      ])
    }
  })
})
