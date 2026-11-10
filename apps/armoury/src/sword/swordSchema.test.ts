import { describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
  normalise,
  type Params,
  randomise,
  seededRandom,
} from '../engine/schema.ts'
import { FAMILIES, type Family, signatureFor } from './families.ts'
import { hasGems, hasRunes, isCross, swordSchema, swordSwatchFor } from './swordSchema.ts'

const KINDS = Object.keys(FAMILIES) as Family[]
const PER_KIND = ['profile', 'middle', 'tip', 'ricasso', 'guard', 'wrap', 'pommel'] as const
const choice = (key: string) =>
  swordSchema.params.find((d) => d.key === key && d.kind === 'choice') as ChoiceParam
const allowed = (key: string, p: Params) => allowedOptions(choice(key), p).map((o) => o.value)
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)

describe('swordSchema', () => {
  it('has the eight groups and 35 params, Kind first', () => {
    expect(swordSchema.itemType).toBe('sword')
    expect(swordSchema.groups.map((g) => g.key)).toEqual([
      'kind',
      'metal',
      'blade',
      'edge',
      'guard',
      'grip',
      'pommel',
      'extras',
    ])
    expect(swordSchema.params).toHaveLength(35)
    expect(swordSchema.params[0]).toMatchObject({ key: 'family', group: 'kind' })
  })

  it('fills an empty object with the default Knight sword', () => {
    expect(sword({})).toMatchObject({
      family: 'knight',
      ...signatureFor('knight'),
      steel: 'satin',
      pattern: 'plain',
      fittings: 'iron',
      gripColour: 'saddle',
      runes: 'none',
      gems: 'none',
    })
  })

  it('starts each Kind with the signature of the roster', () => {
    expect(signatureFor('dagger')).toMatchObject({
      tip: 'longPoint',
      middle: 'ridge',
      guard: 'straight',
      wrap: 'cord',
      pommel: 'wheel',
    })
    expect(signatureFor('shortSword')).toMatchObject({
      tip: 'sharp',
      middle: 'flat',
      guard: 'dome',
      wrap: 'ribbed',
      pommel: 'ball',
    })
    expect(signatureFor('greatsword')).toMatchObject({ guard: 'curved', ricasso: 'short' })
    expect(signatureFor('sabre')).toMatchObject({
      tip: 'curvedPoint',
      middle: 'groove1',
      guard: 'knuckleBow',
      pommel: 'cap',
    })
    expect(signatureFor('katana')).toMatchObject({
      tip: 'kissaki',
      middle: 'ridge',
      guard: 'disc',
      wrap: 'diamond',
      pommel: 'cap',
      pattern: 'temper',
    })
    expect(signatureFor('rapier')).toMatchObject({
      guard: 'swept',
      wrap: 'wire',
      pommel: 'egg',
      ricasso: 'short',
    })
  })

  it('reaches every option of every choice on some Kind', () => {
    const swords = KINDS.flatMap((family) => [
      sword({ family, taper: 0.2 }),
      sword({ family, taper: 0.2, middle: 'flat' }),
    ])
    for (const def of swordSchema.params) {
      if (def.kind !== 'choice') continue
      for (const o of def.options)
        expect(
          swords.some((p) => allowed(def.key, p).includes(o.value)),
          `${def.key}=${o.value}`,
        ).toBe(true)
    }
  })

  it('keeps every allowed option of every per-Kind choice', () => {
    for (const family of KINDS)
      for (const key of PER_KIND)
        for (const value of FAMILIES[family][key]) {
          const p = sword({ family, [key]: value, taper: 0.3 })
          expect(p[key], `${family} ${key}=${value}`).toBe(value)
          expect(sword(p)).toEqual(p)
        }
  })

  it('never leaves a choice outside the new Kind after a change of Kind', () => {
    const rng = seededRandom(7)
    for (let i = 0; i < 50; i++) {
      const before = randomise(swordSchema, rng)
      for (const family of KINDS) {
        const p = sword({ ...before, family })
        for (const key of PER_KIND) expect(FAMILIES[family][key]).toContain(p[key])
      }
    }
  })

  it('keeps the Kind when Try another locks it, and the result is already normal', () => {
    for (const family of KINDS) {
      const rng = seededRandom(family.length * 31)
      const keep = sword({ family })
      for (let i = 0; i < 200; i++) {
        const p = randomise(swordSchema, rng, { keep, locked: ['kind'] })
        expect(p.family).toBe(family)
        expect(sword(p)).toEqual(p)
      }
    }
  })

  describe('coupling', () => {
    it('offers a round tip only on a blade with straight-ish sides', () => {
      expect(sword({ tip: 'rounded', taper: 0.4 }).tip).toBe('rounded')
      expect(sword({ tip: 'rounded', taper: 0.41 }).tip).toBe('sharp')
    })

    it('gives runes a home', () => {
      expect(sword({ middle: 'groove1', runes: 'groove' }).runes).toBe('groove')
      expect(sword({ middle: 'flat', runes: 'groove' }).runes).toBe('none')
      expect(sword({ middle: 'flat', runes: 'centre' }).runes).toBe('centre')
      expect(sword({ middle: 'groove1', runes: 'centre' }).runes).toBe('none')
      expect(sword({ middle: 'flat', pattern: 'watered', runes: 'centre' }).runes).toBe('none')
      expect(sword({ family: 'katana', runes: 'centre' }).runes).toBe('none')
      expect(sword({ family: 'katana', runes: 'base' }).runes).toBe('base')
      expect(hasRunes(sword({ middle: 'groove1', runes: 'groove' }))).toBe(true)
    })

    it('gives gems a seat', () => {
      expect(sword({ gems: 'both' }).gems).toBe('both')
      expect(sword({ family: 'shortSword', pommel: 'block', gems: 'pommel' }).gems).toBe('none')
      expect(sword({ family: 'shortSword', guard: 'dome', gems: 'guard' }).gems).toBe('none')
      expect(sword({ family: 'shortSword', guard: 'dome', gems: 'both' }).gems).toBe('none')
      expect(sword({ family: 'katana', gems: 'both' }).gems).toBe('both')
      expect(sword({ family: 'rapier', guard: 'swept', gems: 'guard' }).gems).toBe('none')
      expect(hasGems(sword({ gems: 'pommel' }))).toBe(true)
    })

    it('keeps the temper line to a Katana in Satin or Mirror steel', () => {
      expect(sword({ family: 'katana', pattern: 'temper' }).pattern).toBe('temper')
      expect(sword({ family: 'katana', steel: 'bright', pattern: 'temper' }).pattern).toBe('temper')
      expect(sword({ family: 'katana', steel: 'dark', pattern: 'temper' }).pattern).not.toBe(
        'temper',
      )
      expect(sword({ family: 'knight', pattern: 'temper' }).pattern).toBe('plain')
    })

    it('drops the engraving when runes and Ripples are both on the blade', () => {
      const busy = { middle: 'groove1', runes: 'groove', pattern: 'watered', engraving: 'vine' }
      expect(sword(busy).engraving).toBe('none')
      expect(sword({ ...busy, runes: 'none' }).engraving).toBe('vine')
      expect(sword({ ...busy, pattern: 'plain' }).engraving).toBe('vine')
    })

    it('keeps a plain base under wavy edges', () => {
      expect(sword({ family: 'dagger', ricasso: 'none' }).ricasso).toBe('none')
      expect(sword({ family: 'dagger', waves: 'flame', ricasso: 'none' }).ricasso).toBe('short')
      expect(sword({ family: 'knight', waves: 'flame' }).waves).toBe('none')
    })

    it('always gives a Rapier a plain base, and only long ones to Rapier and Greatsword', () => {
      expect(sword({ family: 'rapier', ricasso: 'none' }).ricasso).toBe('short')
      expect(sword({ family: 'rapier', ricasso: 'long' }).ricasso).toBe('long')
      expect(sword({ family: 'longsword', ricasso: 'long' }).ricasso).toBe('none')
    })

    it('shows the params that only matter for some swords only then', () => {
      const visible = (key: string, p: Params) =>
        swordSchema.params.find((d) => d.key === key)!.visible?.(p) ?? true
      expect(visible('curve', sword({}))).toBe(false)
      expect(visible('curve', sword({ family: 'sabre' }))).toBe(true)
      expect(visible('waveCount', sword({ family: 'dagger' }))).toBe(false)
      expect(visible('waveCount', sword({ family: 'dagger', waves: 'flame' }))).toBe(true)
      expect(visible('discShape', sword({ family: 'katana' }))).toBe(true)
      expect(visible('discShape', sword({}))).toBe(false)
      expect(visible('gripColour', sword({ wrap: 'wire' }))).toBe(false)
      expect(visible('kissakiSize', sword({ family: 'katana' }))).toBe(true)
      expect(visible('guardEnds', sword({ family: 'katana' }))).toBe(false)
      expect(isCross(sword({}))).toBe(true)
      for (const key of ['profile', 'tip', 'guard', 'wrap', 'pommel']) {
        expect(visible(key, sword({ family: 'katana' })), key).toBe(false)
        expect(visible(key, sword({ family: 'dagger' })), key).toBe(true)
      }
      expect(sword({ family: 'katana', guard: 'straight', wrap: 'leather' })).toMatchObject({
        guard: 'disc',
        wrap: 'diamond',
      })
    })
  })

  it('gives grip colours, rune glows and fittings swatches', () => {
    expect(swordSwatchFor('gripColour', 'saddle')).toBe('#7a4a2a')
    expect(swordSwatchFor('runeColour', 'moonstone')).toBe('#8fe3ff')
    expect(swordSwatchFor('gemColour', 'ruby')).toBe('#c0183c')
    expect(swordSwatchFor('fittings', 'brass')).toMatch(/^#[0-9a-f]{6}$/)
    expect(swordSwatchFor('family', 'knight')).toBeUndefined()
  })
})
