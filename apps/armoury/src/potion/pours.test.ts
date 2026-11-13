import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { fakeSword } from '../items/testing/fakeItem.ts'
import { createWorkbench, startWorkbench, type Workbench } from '../workbench/workbench.ts'
import type { IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { followPours, nextPourKey, pourList, withPours } from './pours.ts'

const potion = (...pours: IngredientId[]) => normalise(potionSchema, withPours(pours))

describe('pourList', () => {
  it('lists the pours bottom first without none', () => {
    expect(pourList(potion('frogfizz', 'bluebell'))).toEqual(['frogfizz', 'bluebell'])
    expect(pourList(potion())).toEqual([])
  })
})

describe('withPours', () => {
  it('fills none above', () => {
    expect(withPours(['bogmurk'])).toEqual({
      pour1: 'bogmurk',
      pour2: 'none',
      pour3: 'none',
      pour4: 'none',
    })
  })
})

describe('nextPourKey', () => {
  it('is the lowest empty slot, null at four', () => {
    expect(nextPourKey(potion())).toBe('pour1')
    expect(nextPourKey(potion('moonmilk', 'rosehip'))).toBe('pour3')
    expect(nextPourKey(potion('moonmilk', 'rosehip', 'starpetal', 'bogmurk'))).toBeNull()
  })
})

describe('followPours', () => {
  const four = potion('moonmilk', 'frogfizz', 'starpetal', 'emberroot')

  it('shifts the rest down when a pour below the top is taken out', () => {
    expect(followPours(four, 'pour1', 'none')).toEqual(
      withPours(['frogfizz', 'starpetal', 'emberroot']),
    )
    expect(followPours(four, 'pour2', 'none')).toEqual(
      withPours(['moonmilk', 'starpetal', 'emberroot']),
    )
    expect(followPours(four, 'pour3', 'none')).toEqual(
      withPours(['moonmilk', 'frogfizz', 'emberroot']),
    )
  })

  it('needs nothing when the top pour is taken out', () => {
    expect(followPours(four, 'pour4', 'none')).toBeUndefined()
  })

  it('lands a pour above a gap in the lowest empty slot', () => {
    const two = potion('moonmilk', 'frogfizz')
    expect(followPours(two, 'pour4', 'bluebell')).toEqual(
      withPours(['moonmilk', 'frogfizz', 'bluebell']),
    )
    expect(followPours(potion(), 'pour3', 'bogmurk')).toEqual(withPours(['bogmurk']))
  })

  it('needs nothing for a pour into the next slot or a swap in place', () => {
    const two = potion('moonmilk', 'frogfizz')
    expect(followPours(two, 'pour3', 'bluebell')).toBeUndefined()
    expect(followPours(four, 'pour2', 'bluebell')).toBeUndefined()
  })

  it('needs nothing for an empty slot set to none', () => {
    expect(followPours(potion('moonmilk'), 'pour3', 'none')).toBeUndefined()
  })

  it('ignores keys that are not pours', () => {
    expect(followPours(four, 'shape', 'round')).toBeUndefined()
  })

  describe('through the workbench reducer', () => {
    const workbench = createWorkbench({
      ...fakeSword,
      schema: potionSchema,
      follows: followPours,
    })
    const pour = (state: Workbench, key: string, value: string) =>
      workbench(state, { type: 'set', key, value })
    const start = (...pours: IngredientId[]) => startWorkbench({ params: potion(...pours) })

    it('takes a pour out of the middle and shifts the rest down', () => {
      const state = pour(startWorkbench({ params: four }), 'pour2', 'none')
      expect(pourList(state.item.params)).toEqual(['moonmilk', 'starpetal', 'emberroot'])
    })

    it('takes the first pour out of a part-full bottle', () => {
      const state = pour(start('moonmilk', 'frogfizz', 'starpetal'), 'pour1', 'none')
      expect(pourList(state.item.params)).toEqual(['frogfizz', 'starpetal'])
    })

    it('lands a pour above a gap in the lowest empty slot', () => {
      const state = pour(start('moonmilk', 'frogfizz'), 'pour4', 'bluebell')
      expect(pourList(state.item.params)).toEqual(['moonmilk', 'frogfizz', 'bluebell'])
    })
  })
})
