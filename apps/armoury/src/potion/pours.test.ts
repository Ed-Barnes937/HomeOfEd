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
    expect(withPours(['puffcap'])).toEqual({ pour1: 'puffcap', pour2: 'none', pour3: 'none' })
  })
})

describe('nextPourKey', () => {
  it('is the lowest empty slot, null at three', () => {
    expect(nextPourKey(potion())).toBe('pour1')
    expect(nextPourKey(potion('moonmilk', 'rosehip'))).toBe('pour3')
    expect(nextPourKey(potion('moonmilk', 'rosehip', 'starpetal'))).toBeNull()
  })
})

describe('followPours', () => {
  it('lands an ingredient above a gap in the lowest empty slot', () => {
    const one = potion('moonmilk')
    expect(followPours(one, 'pour3', 'bluebell')).toEqual(withPours(['moonmilk', 'bluebell']))
    expect(followPours(potion(), 'pour2', 'puffcap')).toEqual(withPours(['puffcap']))
  })

  it('needs nothing for an ingredient into the next slot', () => {
    expect(followPours(potion('moonmilk', 'frogfizz'), 'pour3', 'bluebell')).toBeUndefined()
    expect(followPours(potion(), 'pour1', 'bluebell')).toBeUndefined()
  })

  it('needs nothing for a swap in place or a none', () => {
    const full = potion('moonmilk', 'frogfizz', 'starpetal')
    expect(followPours(full, 'pour2', 'bluebell')).toBeUndefined()
    expect(followPours(full, 'pour2', 'none')).toBeUndefined()
    expect(followPours(potion('moonmilk'), 'pour3', 'none')).toBeUndefined()
  })

  it('ignores keys that are not pours', () => {
    expect(followPours(potion('moonmilk'), 'shape', 'round')).toBeUndefined()
    expect(followPours(potion('moonmilk'), 'mixed', 'yes')).toBeUndefined()
  })

  describe('through the workbench reducer', () => {
    const workbench = createWorkbench({
      ...fakeSword,
      schema: potionSchema,
      follows: followPours,
    })
    const set = (state: Workbench, key: string, value: string) =>
      workbench(state, { type: 'set', key, value })
    const start = (...pours: IngredientId[]) => startWorkbench({ params: potion(...pours) })

    it('lands an ingredient above a gap in the lowest empty slot', () => {
      const state = set(start('moonmilk', 'frogfizz'), 'pour3', 'bluebell')
      expect(pourList(state.item.params)).toEqual(['moonmilk', 'frogfizz', 'bluebell'])
      expect(pourList(set(start(), 'pour3', 'bluebell').item.params)).toEqual(['bluebell'])
    })

    it('mixes when mixed is set on a full bottle, and not on a part-full one', () => {
      const full = set(start('moonmilk', 'frogfizz', 'bluebell'), 'mixed', 'yes')
      expect(full.item.params.mixed).toBe('yes')
      expect(set(start('moonmilk', 'frogfizz'), 'mixed', 'yes').item.params.mixed).toBe('no')
    })

    it('empties the bottle and unmixes it with a set none from the top down', () => {
      let state = set(start('moonmilk', 'frogfizz', 'bluebell'), 'mixed', 'yes')
      for (const key of ['pour3', 'pour2', 'pour1']) state = set(state, key, 'none')
      expect(pourList(state.item.params)).toEqual([])
      expect(state.item.params.mixed).toBe('no')
    })

    it('unmixes as soon as the top ingredient goes', () => {
      const mixed = set(start('moonmilk', 'frogfizz', 'bluebell'), 'mixed', 'yes')
      expect(set(mixed, 'pour3', 'none').item.params.mixed).toBe('no')
    })
  })
})
