import { describe, expect, it } from 'vitest'

import {
  ASH,
  createRegistry,
  EMBER,
  MUD,
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
  it('lists only the base roster, never a reaction product and never mud', () => {
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
      'seed',
    ])
    // Mud is dirt + water's product now (discovery-tree spec §9.5): it is
    // earned, not shipped, so a fresh rail is ten entries long.
    expect(entries.some((entry) => entry.id === MUD)).toBe(false)
    // Obsidian, smoke, steam, sulphur, moss, vine, ember and ash are what the
    // world makes, not what you paint — sulphur only exists where acid has
    // eaten wood, the plants only where a seed found wet soil, an ember only
    // where something set wood smoldering, and ash only where a fire finished
    // the job.
    for (const id of [OBSIDIAN, SMOKE, STEAM, SULPHUR, MOSS, VINE, EMBER, ASH]) {
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
      ['Liquid', ['water', 'lava', 'oil', 'acid']],
      ['Energy', ['fire']],
    ])
  })

  it('earns nothing until something is unlocked', () => {
    expect(buildRailPalette(registry).earned).toEqual([])
  })

  it('carries an unlocked element in the earned list, never in the base groups', () => {
    const { entries, groups, earned } = buildRailPalette(registry, ['mud'])

    expect(earned.map((entry) => entry.name)).toEqual(['mud'])
    // The base rail is what the 1-9 hotkeys index, so an unlock must not touch
    // it (spec §9.8): the EARNED control is the only place mud shows up.
    expect(entries.some((entry) => entry.id === MUD)).toBe(false)
    for (const group of groups) {
      expect(group.entries.some((entry) => entry.id === MUD)).toBe(false)
    }
  })

  it('names and colours an earned element, so the status bar and cursor can read it', () => {
    const palette = buildRailPalette(registry, ['mud'])
    expect(palette.nameOf(MUD)).toBe('mud')
    expect(palette.colourOf(MUD)).toBe(registry.get(MUD)?.colours[0])
  })

  // Scenes remap by name (spec §8), so a scene saved while mud was still in the
  // rail restores its mud cells for as long as mud is a species. Leaving the
  // rail is not leaving the roster - that is what would empty those cells.
  it('keeps mud in the roster it left the rail from', () => {
    expect(registry.all().some((def) => def.name === 'mud')).toBe(true)
  })

  it('ignores an unlock this roster does not know', () => {
    expect(buildRailPalette(registry, ['unobtainium']).earned).toEqual([])
  })

  it('offers four brush sizes, ascending', () => {
    expect(BRUSH_WIDTHS).toHaveLength(4)
    expect([...BRUSH_WIDTHS].sort((a, b) => a - b)).toEqual([...BRUSH_WIDTHS])
  })
})
