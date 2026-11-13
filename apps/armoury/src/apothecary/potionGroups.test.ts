import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { potionItem } from '../potion/item.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import { visibleGroups } from './potionGroups.ts'

const shown = (p: Params) =>
  visibleGroups(p).map((g) => [g.numeral, g.title, g.tab, g.summary(p)] as const)

const potion = (values: Params) =>
  normalise(potionSchema, { ...potionItem.firstVisit(), ...values })

describe('visibleGroups', () => {
  it("shows the first-visit potion's three groups, numbered in order, each with its summary", () => {
    expect(shown(potionItem.firstVisit())).toEqual([
      ['i.', 'What goes in', 'Pours', 'Three pours'],
      ['ii.', 'The bottle', 'Bottle', 'Teardrop flask'],
      ['iii.', 'Stopper and label', 'Finish', 'Cork'],
    ])
  })

  it('counts the pours in words, and calls a bottle with none empty', () => {
    const pours = (p: Params) => visibleGroups(p)[0]!.summary(p)
    expect(pours(potion(withPours(['frogfizz'])))).toBe('One pour')
    expect(pours(potion(withPours([])))).toBe('Empty')
    expect(pours(potion(withPours(['frogfizz', 'moonmilk', 'rosehip', 'bluebell'])))).toBe(
      'Four pours',
    )
  })

  it('sums up the bottle by its shape and the finish by its stopper', () => {
    const p = potion({ shape: 'gourd', stopper: 'wax' })
    expect(
      shown(p)
        .map(([, , , summary]) => summary)
        .slice(1),
    ).toEqual(['Gourd bottle', 'Sealed with wax'])
  })
})
