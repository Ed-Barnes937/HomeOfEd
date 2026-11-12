import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { LONGEST_WAND_MM } from '../stage/stage.ts'
import { wandDescription, wandLore, wandName, wandNumber } from './describe.ts'
import { wandItem } from './item.ts'
import { wandPresets } from './presets.ts'
import { wandSchema } from './wandSchema.ts'

const wand = (overrides: Record<string, unknown>) => normalise(wandSchema, overrides)

describe('the wand item', () => {
  it('is the wand kind, saved where wands have always been saved', () => {
    expect(wandItem.kind).toBe('wand')
    expect(wandItem.schema).toBe(wandSchema)
    expect(wandItem.storageKey).toBe('armoury:save')
  })

  it('starts a first visit with the first preset', () => {
    expect(wandItem.firstVisit()).toEqual(wand(wandPresets[0]!.params))
  })

  it('keeps the kind of wand on Try another', () => {
    expect(wandItem.keeps).toEqual(['kind'])
  })

  it('gives a wand just made a Branch patches of bark, and nothing else a follower', () => {
    expect(wandItem.follows?.(wand({}), 'kind', 'branch')).toEqual({ bark: 'patches' })
    expect(wandItem.follows?.(wand({ kind: 'branch' }), 'kind', 'branch')).toBeUndefined()
    expect(wandItem.follows?.(wand({ kind: 'branch' }), 'kind', 'turned')).toBeUndefined()
    expect(wandItem.follows?.(wand({}), 'wood', 'oak')).toBeUndefined()
  })

  it('describes a wand as the shop always has', () => {
    const p = wandItem.firstVisit()
    expect(wandItem.name(p)).toBe(wandName(p))
    expect(wandItem.number(p)).toBe(wandNumber(p))
    expect(wandItem.tagLine(p)).toBe(wandDescription(p))
    expect(wandItem.lore(p)).toBe(wandLore(p))
    expect(wandItem.name(p)).toBe('The Smoky Spiral')
    expect(wandItem.number(p)).toBe('0634')
  })

  it('labels a shelf box with its length, what it is made of and its core', () => {
    expect(wandItem.shelfLine(wandItem.firstVisit())).toBe('Twelve inches, cherry, starlight')
    expect(wandItem.shelfLine(wand({ lengthCm: 33, wood: 'oak', core: 'stormglass' }))).toBe(
      'Thirteen inches, oak, storm glass',
    )
  })

  it('glows in the colour of its core', () => {
    expect(wandItem.glow(wand({ core: 'starlight' }))).toBe('#ffc95c')
    expect(wandItem.glow(wand({ core: 'wildwood' }))).not.toBe('#ffc95c')
  })

  it('draws the longest wand across the whole fill', () => {
    expect(wandItem.lengthFraction(wand({ lengthCm: 38 }))).toBe(1)
    for (const lengthCm of [28, 30.5, 33]) {
      expect(wandItem.lengthFraction(wand({ lengthCm }))).toBeCloseTo(
        (lengthCm * 10) / LONGEST_WAND_MM,
        12,
      )
    }
  })
})
