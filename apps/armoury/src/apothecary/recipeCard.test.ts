import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { potionItem } from '../potion/item.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { recipeCard } from './recipeCard.ts'

const potion = (p: Params) => normalise(potionSchema, p)
const blend = potion({ pour1: 'thundercloud', pour2: 'moonmilk', pour3: 'none', pour4: 'none' })
const plain = potion({ pour1: 'moonmilk', pour2: 'frogfizz', pour3: 'none', pour4: 'none' })

describe('recipeCard', () => {
  it('names the potion as the generator does, until the player renames it', () => {
    expect(recipeCard(potionItem, { params: plain }).name).toBe(potionItem.name(plain))
    expect(recipeCard(potionItem, { params: blend }).name).toBe('The Moon Behind the Storm')
    expect(recipeCard(potionItem, { params: plain, name: 'Grandma’s Tea' }).name).toBe(
      'Grandma’s Tea',
    )
  })

  it('carries the number and tag line', () => {
    const card = recipeCard(potionItem, { params: plain })
    expect(card.number).toBe(potionItem.number(plain))
    expect(card.description).toBe(potionItem.tagLine(plain))
  })

  it('is gold only for a secret blend, renamed or not', () => {
    expect(recipeCard(potionItem, { params: blend }).gold).toBe(true)
    expect(recipeCard(potionItem, { params: blend, name: 'Mine' }).gold).toBe(true)
    expect(recipeCard(potionItem, { params: plain }).gold).toBe(false)
  })
})
