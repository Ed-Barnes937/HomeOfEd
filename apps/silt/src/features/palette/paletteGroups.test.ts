import { describe, expect, it } from 'vitest'

import { createRegistry, OBSIDIAN, v1Elements, v1Reactions } from '../../sim/index.ts'
import { BRUSH_WIDTHS, buildRailPalette } from './paletteGroups.ts'

// The registry `Sim` builds by default (v1Elements/v1Reactions) — the same
// one the renderer paints from — so this exercises the rail exactly as the
// app wires it, per ticket 16.
const registry = createRegistry(v1Elements, v1Reactions)

describe('paletteGroups', () => {
  it('lists only the paintable v1 roster, never the obsidian reaction product', () => {
    const { entries } = buildRailPalette(registry)
    expect(entries.map((entry) => entry.name)).toEqual(['dirt', 'sand', 'water', 'lava'])
    expect(entries.some((entry) => entry.id === OBSIDIAN)).toBe(false)
  })

  it('omits groups with no members instead of rendering an empty section', () => {
    const { groups } = buildRailPalette(registry)
    const labels = groups.map((group) => group.label)
    expect(labels).toEqual(['Solid', 'Powder', 'Liquid'])
    expect(labels).not.toContain('Energy')
    for (const group of groups) {
      expect(group.entries.length).toBeGreaterThan(0)
    }
  })

  it('offers four brush sizes, ascending', () => {
    expect(BRUSH_WIDTHS).toHaveLength(4)
    expect([...BRUSH_WIDTHS].sort((a, b) => a - b)).toEqual([...BRUSH_WIDTHS])
  })
})
