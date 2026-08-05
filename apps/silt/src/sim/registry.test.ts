import { describe, expect, it } from 'vitest'

import { DIRT, SAND, v1Elements } from './elements.ts'
import { createRegistry } from './registry.ts'
import type { ElementDef } from './types.ts'

const dirt: ElementDef = {
  id: DIRT,
  name: 'dirt',
  colours: ['#8a7358'],
  tags: [],
  archetype: { kind: 'static' },
}

const sand: ElementDef = {
  id: SAND,
  name: 'sand',
  colours: ['#d9b978'],
  tags: ['powder'],
  archetype: { kind: 'powder', density: 4, slide: 1 },
}

describe('createRegistry', () => {
  it('accepts the v1 roster', () => {
    const registry = createRegistry(v1Elements)

    expect(registry.get(SAND)?.name).toBe('sand')
    expect(registry.has(SAND, 'powder')).toBe(true)
    expect(registry.has(DIRT, 'powder')).toBe(false)
  })

  it('rejects duplicate ids', () => {
    expect(() => createRegistry([dirt, { ...sand, id: DIRT }])).toThrow(/duplicate id/i)
  })

  it('rejects duplicate names', () => {
    expect(() => createRegistry([dirt, { ...sand, name: 'dirt' }])).toThrow(/duplicate name/i)
  })

  it('rejects ids reserved by the engine', () => {
    expect(() => createRegistry([{ ...dirt, id: 0 }])).toThrow(/reserved/i)
    expect(() => createRegistry([{ ...dirt, id: 255 }])).toThrow(/reserved/i)
  })

  it('rejects an out-of-range slide probability', () => {
    const slippery = { ...sand, archetype: { ...sand.archetype, slide: 1.5 } }

    expect(() => createRegistry([slippery as ElementDef])).toThrow(/slide/i)
  })

  it('rejects a lifetime naming an unknown element', () => {
    const decaying: ElementDef = {
      ...sand,
      lifetime: { ticks: 10, becomes: 'steam' },
    }

    expect(() => createRegistry([dirt, decaying])).toThrow(/steam/)
  })

  it('rejects a reaction naming an unknown target', () => {
    expect(() =>
      createRegistry(
        [dirt, sand],
        [{ a: 'sand', b: 'lava', p: 1, aBecomes: 'obsidian', bBecomes: null }],
      ),
    ).toThrow(/obsidian/)
  })

  it('rejects a reaction probability outside (0, 1]', () => {
    expect(() =>
      createRegistry(
        [dirt, sand],
        [{ a: 'sand', b: 'dirt', p: 0, aBecomes: null, bBecomes: null }],
      ),
    ).toThrow(/probability/i)
  })

  it('rejects a liquid with a bad dispersion or move probability', () => {
    const base = { ...sand, archetype: { kind: 'liquid', density: 3, dispersion: 2 } } as ElementDef

    expect(() =>
      createRegistry([{ ...base, archetype: { kind: 'liquid', density: 3, dispersion: -1 } }]),
    ).toThrow(/dispersion/i)
    expect(() =>
      createRegistry([
        { ...base, archetype: { kind: 'liquid', density: 3, dispersion: 2, move: 0 } },
      ]),
    ).toThrow(/move/i)
  })

  it('rejects a gas that is not lighter than nothing', () => {
    const balloon = { ...sand, archetype: { kind: 'gas', density: 3, dispersion: 2 } } as ElementDef

    expect(() => createRegistry([balloon])).toThrow(/density/i)
  })

  it('resolves a tag-keyed reaction to every element carrying the tag', () => {
    const registry = createRegistry(
      [dirt, sand],
      [{ a: 'dirt', b: 'powder', p: 1, aBecomes: null, bBecomes: 'dirt' }],
    )

    expect(registry.reactionFor(DIRT, SAND)).toMatchObject({ aBecomes: 0, bBecomes: DIRT })
    // Symmetric: the pair matches whichever side the scan reaches first.
    expect(registry.reactionFor(SAND, DIRT)).toMatchObject({ aBecomes: DIRT, bBecomes: 0 })
    expect(registry.reactionFor(DIRT, DIRT)).toBeUndefined()
  })

  it('drops a pair whose hardness the row cannot touch', () => {
    const registry = createRegistry(
      [{ ...dirt, hardness: 4 }, sand],
      [{ a: 'dirt', b: 'sand', p: 1, aBecomes: null, bBecomes: null, maxHardness: 2 }],
    )

    expect(registry.reactionFor(DIRT, SAND)).toBeUndefined()
  })

  it('reports every problem at once', () => {
    expect(() => createRegistry([dirt, { ...sand, id: DIRT, name: 'dirt' }])).toThrow(
      /duplicate id[\s\S]*duplicate name/i,
    )
  })
})
