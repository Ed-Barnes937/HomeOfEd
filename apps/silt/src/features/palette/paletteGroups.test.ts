import { describe, expect, it } from 'vitest'

import { OBSIDIAN } from '../../sim/index.ts'
import { BRUSH_WIDTHS, paletteEntries, paletteGroups } from './paletteGroups.ts'

describe('paletteGroups', () => {
  it('lists only the paintable v1 roster, never the obsidian reaction product', () => {
    expect(paletteEntries.map((entry) => entry.name)).toEqual(['dirt', 'sand', 'water', 'lava'])
    expect(paletteEntries.some((entry) => entry.id === OBSIDIAN)).toBe(false)
  })

  it('omits groups with no members instead of rendering an empty section', () => {
    const labels = paletteGroups.map((group) => group.label)
    expect(labels).toEqual(['Solid', 'Powder', 'Liquid'])
    expect(labels).not.toContain('Energy')
    for (const group of paletteGroups) {
      expect(group.entries.length).toBeGreaterThan(0)
    }
  })

  it('offers four brush sizes, ascending', () => {
    expect(BRUSH_WIDTHS).toHaveLength(4)
    expect([...BRUSH_WIDTHS].sort((a, b) => a - b)).toEqual([...BRUSH_WIDTHS])
  })
})
