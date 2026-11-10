import { describe, expect, it } from 'vitest'

import { normalise, randomise, seededRandom, type Params } from '../engine/schema.ts'
import {
  DO_NOT_USE,
  lengthInWords,
  nameFrom,
  swordGlowColour,
  swordLore,
  swordName,
  swordNumber,
  swordShelfLine,
  swordTagLine,
  SWORD_COLOURS,
  SWORD_NOUNS,
} from './describe.ts'
import { type Family, FAMILIES, signatureFor } from './families.ts'
import { swordPresets } from './presets.ts'
import { swordSchema } from './swordSchema.ts'

const sword = (overrides: Record<string, unknown>) => normalise(swordSchema, overrides)
const kindOf = (family: Family) => sword({ family, ...signatureFor(family) })
const FAMILY_KEYS = Object.keys(FAMILIES) as Family[]
const joined = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '')

const borrowedWord = (text: string) =>
  DO_NOT_USE.find((entry) =>
    new RegExp(`\\b${entry.toLowerCase().replace(/[^a-z' ]/g, '')}\\b`).test(text.toLowerCase()),
  )

describe('lengthInWords', () => {
  it.each([
    [13, 'Thirteen inches'],
    [15.5, 'Fifteen and a half inches'],
    [37, 'Thirty-seven inches'],
    [69, 'Sixty-nine inches'],
    [40, 'Forty inches'],
    [70, 'Seventy inches'],
  ])('%s inches reads as "%s"', (inches, words) => {
    expect(lengthInWords(inches * 25.4)).toBe(words)
  })

  it('rounds to the nearest half inch', () => {
    expect(lengthInWords(31.2 * 25.4)).toBe('Thirty-one inches')
    expect(lengthInWords(31.3 * 25.4)).toBe('Thirty-one and a half inches')
  })
})

describe('swordName', () => {
  it('names a plain sword of each Kind after its Kind', () => {
    const names = FAMILY_KEYS.map((family) => swordName(kindOf(family)))
    expect(names).toEqual([
      'The Steel Wren',
      'The Steel Badger',
      'The Steel Warden',
      'The Steel Pilgrim',
      'The Steel Giant',
      'The Steel Swallow',
      'The Tide Heron',
      'The Steel Quill',
    ])
  })

  it('takes its colour from the pattern, then the steel, then the fittings', () => {
    const knight = kindOf('knight')
    expect(swordName({ ...knight, pattern: 'watered', steel: 'dark' })).toBe('The Rippled Warden')
    expect(swordName({ ...knight, steel: 'blue', fittings: 'gold' })).toBe('The Blue Warden')
    expect(swordName({ ...knight, steel: 'dark' })).toBe('The Night Warden')
    expect(swordName({ ...knight, steel: 'silver' })).toBe('The Silver Warden')
    expect(swordName({ ...knight, steel: 'bright', fittings: 'gold' })).toBe('The Bright Warden')
    expect(swordName({ ...knight, fittings: 'gold' })).toBe('The Golden Warden')
    expect(swordName({ ...knight, fittings: 'darkIron' })).toBe('The Dusk Warden')
  })

  it('takes its noun from the most distinctive feature before the Kind', () => {
    const greatsword = kindOf('greatsword')
    const everything = { ...greatsword, waves: 'flame', runes: 'base', gems: 'both' }
    expect(swordName(sword(everything))).toBe('The Steel Flame')
    expect(swordName(sword({ ...everything, waves: 'none' }))).toBe('The Steel Rune')
    expect(swordName(sword({ ...kindOf('knight'), profile: 'leaf', gems: 'pommel' }))).toBe(
      'The Steel Leaf',
    )
    expect(swordName(sword({ ...kindOf('sabre'), profile: 'flared', gems: 'pommel' }))).toBe(
      'The Steel Crescent',
    )
    expect(swordName(sword({ ...greatsword, gems: 'pommel' }))).toBe('The Steel Star')
    expect(swordName(sword({ ...greatsword, gems: 'pommel', fittings: 'bronze' }))).toBe(
      'The Bronze Giant',
    )
  })

  it('never borrows a famous name: Silver and Leaf falls back to the Kind', () => {
    expect(swordName(sword({ ...kindOf('knight'), profile: 'leaf', steel: 'silver' }))).toBe(
      'The Silver Warden',
    )
  })

  it('makes no borrowed name from any colour and noun, for any Kind', () => {
    const banned = new Set(DO_NOT_USE.map(joined))
    const nouns = [...Object.values(SWORD_NOUNS.features), ...Object.values(SWORD_NOUNS.kinds)]
    for (const colour of new Set(Object.values(SWORD_COLOURS))) {
      for (const kindNoun of Object.values(SWORD_NOUNS.kinds)) {
        expect(banned.has(joined(`${colour}${kindNoun}`))).toBe(false)
        for (const noun of nouns) {
          expect(banned.has(joined(nameFrom(colour, noun, kindNoun).replace(/^The /, '')))).toBe(
            false,
          )
        }
      }
    }
  })

  it('gives no preset a borrowed name, and names each preset differently', () => {
    const banned = new Set(DO_NOT_USE.map(joined))
    const names = swordPresets.map((preset) => {
      const p = sword(preset.params)
      expect(banned.has(joined(preset.name))).toBe(false)
      expect(banned.has(joined(swordName(p).replace(/^The /, '')))).toBe(false)
      return swordName(p)
    })
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('swordNumber', () => {
  it('is a four-digit mark number, stable for the same sword', () => {
    const p = kindOf('longsword')
    expect(swordNumber(p)).toMatch(/^\d{4}$/)
    expect(swordNumber(p)).toBe(swordNumber(sword({ ...p })))
  })

  it('changes when a param changes', () => {
    const p = kindOf('longsword')
    expect(swordNumber({ ...p, bladeLength: 0.51 })).not.toBe(swordNumber(p))
    expect(swordNumber({ ...p, gripColour: 'navy' })).not.toBe(swordNumber(p))
  })
})

describe('swordTagLine', () => {
  it('reads like a smith ticket: length, steel, hilt and how it feels', () => {
    expect(swordTagLine(swordPresets.length ? sword(swordPresets[0]!.params) : {})).toMatch(
      /^[A-Z][a-z-]+( and a half)? inches, satin steel, iron hilt\. Steady\.$/,
    )
    expect(
      swordTagLine(sword({ ...kindOf('knight'), steel: 'bright', fittings: 'brass' })),
    ).toMatch(/, mirror steel, brass hilt\. Steady\.$/)
    expect(
      swordTagLine(sword({ ...kindOf('knight'), pattern: 'watered', fittings: 'darkIron' })),
    ).toMatch(/, rippled steel, dark iron hilt\./)
  })

  it('feels light on a Rapier, swift on a Sabre, mighty when long and broad, quick or balanced when slim', () => {
    expect(swordTagLine(kindOf('rapier'))).toMatch(/ Light as a feather\.$/)
    expect(swordTagLine(kindOf('sabre'))).toMatch(/ Swift\.$/)
    const big = { bladeLength: 0.8, bladeWidth: 0.8 }
    expect(swordTagLine(sword({ ...kindOf('longsword'), ...big }))).toMatch(/ Mighty\.$/)
    expect(swordTagLine(sword({ ...kindOf('dagger'), ...big }))).toMatch(/ Steady\.$/)
    expect(swordTagLine(sword({ ...kindOf('knight'), bladeWidth: 0.2 }))).toMatch(
      / Quick in the hand\.$/,
    )
    expect(swordTagLine(sword({ ...kindOf('greatsword'), bladeWidth: 0.2 }))).toMatch(
      / Well balanced\.$/,
    )
  })
})

describe('swordLore', () => {
  it('tells the steel, then the fittings', () => {
    expect(swordLore(kindOf('knight'))).toBe(
      'Satin steel is patient and does its work without showing off. Iron fittings never complain.',
    )
  })

  it('tells the pattern before the steel, and the runes before the fittings', () => {
    const lore = swordLore(
      sword({ ...kindOf('knight'), pattern: 'watered', runes: 'groove', runeColour: 'starlight' }),
    )
    expect(lore).toMatch(/^Rippled steel /)
    expect(lore).toMatch(/starlight runes/)
  })

  it('keeps Silver plain', () => {
    expect(swordLore(sword({ ...kindOf('knight'), steel: 'silver' }))).toMatch(
      /^A silver blade is bright, kind and a little bit proud\./,
    )
  })

  it('has a line for every steel, pattern, fittings metal and rune colour', () => {
    const steels = ['satin', 'bright', 'dark', 'silver', 'blue']
    const fittings = ['iron', 'darkIron', 'brass', 'bronze', 'silver', 'gold', 'blue']
    const colours = ['starlight', 'moonstone', 'wildwood', 'stormglass', 'emberstone']
    const lines = new Set<string>()
    for (const steel of steels)
      for (const fitting of fittings) {
        lines.add(swordLore(sword({ ...kindOf('knight'), steel, fittings: fitting })))
      }
    expect(lines.size).toBe(steels.length * fittings.length)
    for (const runeColour of colours) {
      const lore = swordLore(sword({ ...kindOf('knight'), runes: 'base', runeColour }))
      expect(lore.split('. ')).toHaveLength(2)
    }
  })
})

describe('swordShelfLine', () => {
  it('says the Kind, the length and the steel', () => {
    expect(swordShelfLine(kindOf('knight'))).toMatch(
      /^Knight's sword, [a-z-]+( and a half)? inches, satin steel$/,
    )
    expect(swordShelfLine(sword({ ...kindOf('dagger'), steel: 'dark' }))).toMatch(
      /^Dagger, [a-z]+.* inches, black steel$/,
    )
  })
})

describe('swordGlowColour', () => {
  const knight = kindOf('knight')

  it('glows forge ember with no runes and no gems', () => {
    expect(swordGlowColour(knight)).toBe('#ff8a2a')
  })

  it('glows the rune colour with runes, or with gems that match them', () => {
    expect(swordGlowColour(sword({ ...knight, runes: 'base', runeColour: 'wildwood' }))).toBe(
      '#6dff9c',
    )
    expect(swordGlowColour(sword({ ...knight, gems: 'pommel', runeColour: 'stormglass' }))).toBe(
      '#c49bff',
    )
    expect(
      swordGlowColour(
        sword({
          ...knight,
          runes: 'base',
          runeColour: 'wildwood',
          gems: 'pommel',
          gemColour: 'ruby',
        }),
      ),
    ).toBe('#6dff9c')
  })

  it("glows the gem's own colour with gems of their own", () => {
    expect(swordGlowColour(sword({ ...knight, gems: 'pommel', gemColour: 'sapphire' }))).toBe(
      '#2546b8',
    )
  })
})

describe('every Kind, its signature and fifty random swords', () => {
  const samples: Params[] = FAMILY_KEYS.flatMap((family) => [
    kindOf(family),
    ...Array.from({ length: 50 }, (_, i) =>
      randomise(swordSchema, seededRandom(1000 * (FAMILY_KEYS.indexOf(family) + 1) + i), {
        keep: { family },
        locked: ['kind'],
      }),
    ),
  ])

  it('has a name, number, tag line, lore and shelf line, none empty and none borrowed', () => {
    for (const p of samples) {
      const words = [swordName(p), swordNumber(p), swordTagLine(p), swordLore(p), swordShelfLine(p)]
      for (const text of words) {
        expect(text.trim()).not.toBe('')
        expect(text).not.toMatch(/undefined|NaN/)
        expect(borrowedWord(text)).toBeUndefined()
      }
      expect(swordLore(p).match(/[.!]( |$)/g)).toHaveLength(2)
      expect(swordGlowColour(p)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
