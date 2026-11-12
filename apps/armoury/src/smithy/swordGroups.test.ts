import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { type Family, signatureFor } from '../sword/families.ts'
import { swordItem } from '../sword/item.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { visibleGroups } from './swordGroups.ts'

const firstVisit = swordItem.firstVisit()
const asKind = (family: Family, extra: Params = {}): Params =>
  normalise(swordSchema, { ...firstVisit, family, ...signatureFor(family), ...extra })

const INCHES = /^\d+(\.5)? in$/

const shown = (p: Params) =>
  visibleGroups(p).map((g) => [g.numeral, g.title, g.tab, g.summary(p)] as const)

describe('visibleGroups', () => {
  it("shows a Knight's sword's seven groups, numbered in order, each with its summary", () => {
    expect(shown(firstVisit)).toEqual([
      ['i.', 'The metal', 'Metal', 'Satin'],
      ['ii.', 'The blade', 'Blade', expect.stringMatching(INCHES)],
      ['iii.', 'Edge and tip', 'Tip', 'Sharp'],
      ['iv.', 'The guard', 'Guard', 'Straight'],
      ['v.', 'The grip', 'Grip', 'Leather'],
      ['vi.', 'The pommel', 'Pommel', 'Wheel'],
      ['vii.', 'Finishing touches', 'Extras', 'Plain'],
    ])
  })

  it('sums up a Katana by its own parts, and the extras by what it carries', () => {
    const katana = asKind('katana', { steel: 'bright', gems: 'pommel' })
    expect(shown(katana)).toEqual([
      ['i.', 'The metal', 'Metal', 'Mirror'],
      ['ii.', 'The blade', 'Blade', expect.stringMatching(INCHES)],
      ['iii.', 'Edge and tip', 'Tip', 'Angled'],
      ['iv.', 'The guard', 'Guard', 'Disc'],
      ['v.', 'The grip', 'Grip', 'Diamond wrap'],
      ['vi.', 'The pommel', 'Pommel', 'Cap'],
      ['vii.', 'Finishing touches', 'Extras', 'Gems'],
    ])
  })

  it("gives the blade's summary as the whole sword's length, in half inches", () => {
    const length = (p: Params) => parseFloat(visibleGroups(p)[1]!.summary(p))
    expect(length(asKind('knight', { bladeLength: 1 }))).toBeGreaterThan(length(firstVisit))
  })

  it('says whether the extras are runes, gems or both', () => {
    const extras = (p: Params) => visibleGroups(p).at(-1)!.summary(p)
    expect(extras(asKind('knight', { runes: 'base' }))).toBe('Runes')
    expect(extras(asKind('knight', { runes: 'base', gems: 'both' }))).toBe('Runes and gems')
  })
})
