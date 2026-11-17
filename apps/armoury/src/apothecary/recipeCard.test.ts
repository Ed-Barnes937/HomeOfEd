import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { potionItem } from '../potion/item.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { recipeCard } from './recipeCard.ts'

const potion = (p: Params) => normalise(potionSchema, p)
const blendRecipe = { pour1: 'thundercloud', pour2: 'thundercloud', pour3: 'moonmilk' }
const plainRecipe = { pour1: 'moonmilk', pour2: 'frogfizz', pour3: 'rosehip' }
const unmixedBlend = potion({ ...blendRecipe, mixed: 'no' })
const blend = potion({ ...blendRecipe, mixed: 'yes' })
const unmixedPlain = potion({ ...plainRecipe, mixed: 'no' })
const plain = potion({ ...plainRecipe, mixed: 'yes' })

describe('recipeCard', () => {
  it('names the potion as the generator does, until the player renames it', () => {
    expect(recipeCard(potionItem, { params: plain }).name).toBe(potionItem.name(plain))
    expect(recipeCard(potionItem, { params: plain, name: 'Grandma’s Tea' }).name).toBe(
      'Grandma’s Tea',
    )
  })

  it('shows the layers as its name before the mix and the revealed name after', () => {
    expect(recipeCard(potionItem, { params: unmixedBlend }).name).toBe(
      'Double Thundercloud and Moonmilk',
    )
    expect(recipeCard(potionItem, { params: unmixedPlain }).name).toBe(
      'Moonmilk, Frogfizz and Rosehip',
    )
    expect(recipeCard(potionItem, { params: blend }).name).toBe('The Moon Behind the Storm')
    expect(recipeCard(potionItem, { params: plain }).name).not.toBe(
      recipeCard(potionItem, { params: unmixedPlain }).name,
    )
  })

  it('carries the number and tag line', () => {
    const card = recipeCard(potionItem, { params: plain })
    expect(card.number).toBe(potionItem.number(plain))
    expect(card.description).toBe(potionItem.tagLine(plain))
  })

  it('is gold only for a mixed secret blend, renamed or not', () => {
    expect(recipeCard(potionItem, { params: blend }).gold).toBe(true)
    expect(recipeCard(potionItem, { params: blend, name: 'Mine' }).gold).toBe(true)
    expect(recipeCard(potionItem, { params: unmixedBlend }).gold).toBe(false)
    expect(recipeCard(potionItem, { params: plain }).gold).toBe(false)
  })
})
