import type { Params } from '../engine/schema.ts'
import type { ItemDef } from '../items/item.ts'
import { secretBlend } from '../potion/blends.ts'

export interface RecipeCard {
  number: string
  name: string
  description: string
  /** A secret blend's card has a gold edge and ink. */
  gold: boolean
}

/** What the potion's recipe card says, on the scene and in the picture. */
export function recipeCard(def: ItemDef, item: { params: Params; name?: string }): RecipeCard {
  return {
    number: def.number(item.params),
    name: item.name ?? def.name(item.params),
    description: def.tagLine(item.params),
    gold: secretBlend(item.params) !== null,
  }
}
