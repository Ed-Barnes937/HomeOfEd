import { describe, expect, it } from 'vitest'

import {
  createRegistry,
  EMBER,
  OBSIDIAN,
  MOSS,
  SMOKE,
  STEAM,
  SULPHUR,
  VINE,
  v1Elements,
  v1Reactions,
} from '../../sim/index.ts'
import { BRUSH_WIDTHS, buildRailPalette } from './paletteGroups.ts'

// The registry `Sim` builds by default (v1Elements/v1Reactions) — the same
// one the renderer paints from — so this exercises the rail exactly as the
// app wires it, per ticket 16.
const registry = createRegistry(v1Elements, v1Reactions)

describe('paletteGroups', () => {
  it('lists only the paintable roster, never a reaction product', () => {
    const { entries } = buildRailPalette(registry)
    expect(entries.map((entry) => entry.name)).toEqual([
      'dirt',
      'sand',
      'water',
      'lava',
      'wood',
      'oil',
      'fire',
      'acid',
      'stone',
      'mud',
      'seed',
    ])
    // Obsidian, smoke, steam, sulphur, moss, vine and ember are what the world
    // makes, not what you paint — sulphur only exists where acid has eaten
    // wood, the plants only where a seed found wet soil, and an ember only
    // where something set wood smoldering.
    for (const id of [OBSIDIAN, SMOKE, STEAM, SULPHUR, MOSS, VINE, EMBER]) {
      expect(entries.some((entry) => entry.id === id)).toBe(false)
    }
  })

  it('groups the roster in rail order, Energy included now fire is paintable', () => {
    const { groups } = buildRailPalette(registry)
    expect(
      groups.map((group) => [group.label, group.entries.map((entry) => entry.name)]),
    ).toEqual([
      ['Solid', ['dirt', 'wood', 'stone']],
      ['Powder', ['sand', 'seed']],
      ['Liquid', ['water', 'lava', 'oil', 'acid', 'mud']],
      ['Energy', ['fire']],
    ])
  })

  it('offers four brush sizes, ascending', () => {
    expect(BRUSH_WIDTHS).toHaveLength(4)
    expect([...BRUSH_WIDTHS].sort((a, b) => a - b)).toEqual([...BRUSH_WIDTHS])
  })
})
