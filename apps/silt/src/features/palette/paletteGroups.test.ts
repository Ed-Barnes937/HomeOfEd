import { describe, expect, it } from 'vitest'

import {
  createRegistry,
  OBSIDIAN,
  SMOKE,
  STEAM,
  SULPHUR,
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
    ])
    // Obsidian, smoke, steam and sulphur are what the world makes, not what
    // you paint — sulphur only exists where acid has eaten wood.
    for (const id of [OBSIDIAN, SMOKE, STEAM, SULPHUR]) {
      expect(entries.some((entry) => entry.id === id)).toBe(false)
    }
  })

  it('groups the roster in rail order, Energy included now fire is paintable', () => {
    const { groups } = buildRailPalette(registry)
    expect(
      groups.map((group) => [group.label, group.entries.map((entry) => entry.name)]),
    ).toEqual([
      ['Solid', ['dirt', 'wood', 'stone']],
      ['Powder', ['sand']],
      ['Liquid', ['water', 'lava', 'oil', 'acid']],
      ['Energy', ['fire']],
    ])
  })

  it('offers four brush sizes, ascending', () => {
    expect(BRUSH_WIDTHS).toHaveLength(4)
    expect([...BRUSH_WIDTHS].sort((a, b) => a - b)).toEqual([...BRUSH_WIDTHS])
  })
})
