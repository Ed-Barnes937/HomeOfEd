import type { Params } from '../engine/schema.ts'
import type { IngredientId } from './ingredients.ts'
import { pourList } from './pours.ts'

export interface SecretBlend {
  id: string
  /** Bottom first. */
  pours: IngredientId[]
  name: string
  lore: string
}

export const SECRET_BLENDS: readonly SecretBlend[] = [
  {
    id: 'moon-behind-storm',
    pours: ['thundercloud', 'moonmilk'],
    name: 'The Moon Behind the Storm',
    lore: 'Dark clouds rolled over the hill and the moon hid behind them. She was only waiting for her turn to shine.',
  },
  {
    id: 'sunrise',
    pours: ['bluebell', 'frogfizz', 'starpetal', 'emberroot'],
    name: 'Sunrise in a Bottle',
    lore: 'Cool blue dew, a hop of green, a little gold and then a warm orange glow. The whole morning fits in here, birdsong and all.',
  },
  {
    id: 'sunset',
    pours: ['emberroot', 'starpetal', 'frogfizz', 'bluebell'],
    name: 'Sunset in a Bottle',
    lore: 'A warm orange glow, a little gold, a hop of green and then the blue of the coming night. Hold it up and the day is just going to bed.',
  },
  {
    id: 'pond-life',
    pours: ['bogmurk', 'frogfizz'],
    name: 'Pond Life',
    lore: 'Mud at the bottom and a bit of green on top. Somebody lives here, and they are very happy about it.',
  },
  {
    id: 'frogspawn',
    pours: ['frogfizz', 'bogmurk', 'frogfizz'],
    name: 'Frogspawn Surprise',
    lore: 'Green, then murk, then green again, as if something is about to hatch. Nobody knows what, and that is the best part.',
  },
  {
    id: 'milky-way',
    pours: ['moonmilk', 'moonmilk', 'starpetal', 'starpetal'],
    name: 'The Milky Way',
    lore: 'Two big soft clouds of moonmilk with a scatter of stars on top. Look closely and it goes on for ever.',
  },
  {
    id: 'pink-ribbons',
    pours: ['rosehip', 'moonmilk', 'rosehip', 'moonmilk'],
    name: 'Pink Ribbons',
    lore: 'Pink and pearl, pink and pearl, wound round like ribbon on a present. Somebody tied a very good bow.',
  },
  {
    id: 'storms-gold-star',
    pours: ['thundercloud', 'thundercloud', 'thundercloud', 'starpetal'],
    name: "The Storm's Gold Star",
    lore: 'Three dark storm clouds and one bright star that would not be put out. Even the thunder had to admit it was brave.',
  },
  {
    id: 'sea-glass',
    pours: ['snailshine', 'bluebell', 'snailshine', 'bluebell'],
    name: 'Sea Glass',
    lore: 'Teal and blue, teal and blue, smooth as a pebble from the beach. The waves have been rolling it about for a hundred years.',
  },
  {
    id: 'clouds-blue-day',
    pours: ['moonmilk', 'bluebell', 'moonmilk'],
    name: 'Clouds on a Blue Day',
    lore: 'A white cloud, a patch of blue sky and another white cloud. It is the sort of weather that makes you want to lie on the grass.',
  },
  {
    id: 'bottom-of-the-pond',
    pours: ['bogmurk', 'bogmurk', 'bogmurk', 'bogmurk'],
    name: 'Bottom of the Pond',
    lore: 'Four whole layers of the very best mud. Frogs would pay a fortune for this.',
  },
  {
    id: 'pocketful-of-stars',
    pours: ['starpetal', 'starpetal', 'starpetal', 'starpetal'],
    name: 'A Pocketful of Stars',
    lore: 'Four starpetals in one bottle, all twinkling at once. Handle with care, because they like to wander.',
  },
]

/** The blend whose pours are exactly this potion's, bottom first, or null. */
export function secretBlend(p: Params): SecretBlend | null {
  const list = pourList(p)
  return (
    SECRET_BLENDS.find(
      (b) => b.pours.length === list.length && b.pours.every((id, i) => id === list[i]),
    ) ?? null
  )
}
