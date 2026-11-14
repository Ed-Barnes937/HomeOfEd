// One data row per ingredient, in wheel order. Ids are persisted in saves and
// links and never change; labels, words, colours and lore may.

export type IngredientId =
  | 'emberroot'
  | 'starpetal'
  | 'frogfizz'
  | 'snailshine'
  | 'bluebell'
  | 'thundercloud'
  | 'moonmilk'
  | 'rosehip'
  | 'puffcap'

export type Trait = 'clear' | 'cloud' | 'fizz' | 'glitter' | 'glow' | 'swirl' | 'murk'

export type EffectKind = 'floating' | 'sparkling' | 'dreamy' | 'glowing' | 'whirling' | 'whiffy'

export interface Ingredient {
  id: IngredientId
  label: string
  /** The word that goes in a potion's name. */
  word: string
  /** Place round the colour wheel, 0-8. */
  wheel: number
  colour: string
  trait: Trait
  /** The effect of three of this ingredient. */
  effect: EffectKind
  lore: string
}

export const INGREDIENTS: readonly Ingredient[] = [
  {
    id: 'emberroot',
    label: 'Emberroot',
    word: 'Emberroot',
    wheel: 0,
    colour: '#ea7b2c',
    trait: 'glow',
    effect: 'glowing',
    lore: 'Emberroot stays warm long after it is dug up.',
  },
  {
    id: 'starpetal',
    label: 'Starpetal',
    word: 'Starpetal',
    wheel: 1,
    colour: '#f2c14e',
    trait: 'glitter',
    effect: 'glowing',
    lore: 'Starpetals only open after dark, and then they glow.',
  },
  {
    id: 'frogfizz',
    label: 'Frogfizz',
    word: 'Frogfizz',
    wheel: 2,
    colour: '#7ccf4f',
    trait: 'fizz',
    effect: 'floating',
    lore: 'Frogfizz hops about in the jar when nobody is looking.',
  },
  {
    id: 'snailshine',
    label: 'Snailshine',
    word: 'Snailshine',
    wheel: 3,
    colour: '#7fd6c8',
    trait: 'swirl',
    effect: 'sparkling',
    lore: 'Snailshine is the silver trail a snail leaves on a wet night.',
  },
  {
    id: 'bluebell',
    label: 'Bluebell dew',
    word: 'Bluebell',
    wheel: 4,
    colour: '#5b8def',
    trait: 'clear',
    effect: 'sparkling',
    lore: 'Bluebell dew is gathered before the birds wake up, while it still twinkles.',
  },
  {
    id: 'thundercloud',
    label: 'Thundercloud',
    word: 'Thundercloud',
    wheel: 5,
    colour: '#4b3f8f',
    trait: 'glitter',
    effect: 'whirling',
    lore: 'Thundercloud rumbles when it is cross.',
  },
  {
    id: 'moonmilk',
    label: 'Moonmilk',
    word: 'Moonmilk',
    wheel: 6,
    colour: '#ece6f4',
    trait: 'cloud',
    effect: 'dreamy',
    lore: 'Moonmilk is skimmed off puddles on full-moon nights.',
  },
  {
    id: 'rosehip',
    label: 'Rosehip syrup',
    word: 'Rosehip',
    wheel: 7,
    colour: '#d9467a',
    trait: 'swirl',
    effect: 'dreamy',
    lore: 'Rosehip syrup stirs itself if you hum it a lullaby.',
  },
  {
    id: 'puffcap',
    label: 'Puffcap',
    word: 'Puffcap',
    wheel: 8,
    colour: '#c9343f',
    trait: 'cloud',
    effect: 'whiffy',
    lore: 'Puffcaps go puff if you poke them, so nobody pokes them twice.',
  },
]

export const isIngredient = (v: unknown): v is IngredientId => INGREDIENTS.some((i) => i.id === v)

export function ingredient(id: IngredientId): Ingredient {
  return INGREDIENTS.find((i) => i.id === id)!
}
