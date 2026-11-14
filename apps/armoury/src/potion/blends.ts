import type { Params } from '../engine/schema.ts'
import type { IngredientId } from './ingredients.ts'
import { isMixed } from './potionSchema.ts'
import { pourList } from './pours.ts'

export interface SecretBlend {
  id: string
  /** In any order. */
  recipe: [IngredientId, IngredientId, IngredientId]
  name: string
  lore: string
}

export const SECRET_BLENDS: readonly SecretBlend[] = [
  {
    id: 'moon-behind-storm',
    recipe: ['thundercloud', 'thundercloud', 'moonmilk'],
    name: 'The Moon Behind the Storm',
    lore: 'Dark clouds rolled over the hill and the moon hid behind them. She was only waiting for her turn to shine.',
  },
  {
    id: 'sunrise',
    recipe: ['bluebell', 'starpetal', 'emberroot'],
    name: 'Sunrise in a Bottle',
    lore: 'Cool blue dew, a little gold and a warm orange glow, swirled together. The whole morning fits in here, birdsong and all.',
  },
  {
    id: 'sunset',
    recipe: ['emberroot', 'rosehip', 'thundercloud'],
    name: 'Sunset in a Bottle',
    lore: 'A warm orange glow, a blush of pink and the deep blue of the coming night. Hold it up and the day is just going to bed.',
  },
  {
    id: 'pond-life',
    recipe: ['frogfizz', 'snailshine', 'bluebell'],
    name: 'Pond Life',
    lore: 'A frog, a snail and a drop of dew. Somebody lives here, and they are very happy about it.',
  },
  {
    id: 'frogspawn',
    recipe: ['frogfizz', 'frogfizz', 'moonmilk'],
    name: 'Frogspawn Surprise',
    lore: 'Green and pearly, with little dots in it, as if something is about to hatch. Nobody knows what, and that is the best part.',
  },
  {
    id: 'milky-way',
    recipe: ['moonmilk', 'moonmilk', 'starpetal'],
    name: 'The Milky Way',
    lore: 'Two big soft clouds of moonmilk with a scatter of stars stirred in. Look closely and it goes on for ever.',
  },
  {
    id: 'pink-ribbons',
    recipe: ['rosehip', 'rosehip', 'moonmilk'],
    name: 'Pink Ribbons',
    lore: 'Pink and pearl, wound round and round like ribbon on a present. Somebody tied a very good bow.',
  },
  {
    id: 'storms-gold-star',
    recipe: ['thundercloud', 'thundercloud', 'starpetal'],
    name: "The Storm's Gold Star",
    lore: 'Two dark storm clouds and one bright star that would not be put out. Even the thunder had to admit it was brave.',
  },
  {
    id: 'sea-glass',
    recipe: ['snailshine', 'snailshine', 'bluebell'],
    name: 'Sea Glass',
    lore: 'Teal and blue, smooth as a pebble from the beach. The waves have been rolling it about for a hundred years.',
  },
  {
    id: 'clouds-blue-day',
    recipe: ['moonmilk', 'moonmilk', 'bluebell'],
    name: 'Clouds on a Blue Day',
    lore: 'White clouds and a patch of blue sky, blowing about. It is the sort of weather that makes you want to lie on the grass.',
  },
  {
    id: 'bottom-of-the-pond',
    recipe: ['frogfizz', 'thundercloud', 'puffcap'],
    name: 'Bottom of the Pond',
    lore: 'Three things that do not get on, all in one bottle, gone wonderfully murky. Frogs would pay a fortune for this.',
  },
  {
    id: 'pocketful-of-stars',
    recipe: ['starpetal', 'starpetal', 'starpetal'],
    name: 'A Pocketful of Stars',
    lore: 'Three starpetals in one bottle, all twinkling at once. Handle with care, because they like to wander.',
  },
]

const key = (ids: readonly IngredientId[]) => [...ids].sort().join()

/** The blend whose three ingredients, in any order, are exactly this mixed potion's, or null. */
export function secretBlend(p: Params): SecretBlend | null {
  if (!isMixed(p)) return null
  const recipe = key(pourList(p))
  return SECRET_BLENDS.find((b) => key(b.recipe) === recipe) ?? null
}
