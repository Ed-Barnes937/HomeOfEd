// One data row per ingredient. Ids are persisted in saves and links and never
// change; labels, words, colours and lore may.

export type IngredientId =
  | 'moonmilk'
  | 'frogfizz'
  | 'starpetal'
  | 'emberroot'
  | 'bluebell'
  | 'rosehip'
  | 'thundercloud'
  | 'snailshine'
  | 'bogmurk'

export type Trait = 'clear' | 'cloud' | 'fizz' | 'glitter' | 'glow' | 'swirl'

export type EffectKind = 'floating' | 'sparkling' | 'dreamy' | 'glowing' | 'whirling' | 'whiffy'

export interface Ingredient {
  id: IngredientId
  label: string
  /** The word that goes in a potion's name. */
  word: string
  colour: string
  trait: Trait
  effect: EffectKind
  lore: string
}

export const INGREDIENTS: readonly Ingredient[] = [
  {
    id: 'moonmilk',
    label: 'Moonmilk',
    word: 'Moonmilk',
    colour: '#ece6f4',
    trait: 'cloud',
    effect: 'dreamy',
    lore: 'Moonmilk is skimmed off puddles on full-moon nights.',
  },
  {
    id: 'frogfizz',
    label: 'Frogfizz',
    word: 'Frogfizz',
    colour: '#7ccf4f',
    trait: 'fizz',
    effect: 'floating',
    lore: 'Frogfizz hops about in the jar when nobody is looking.',
  },
  {
    id: 'starpetal',
    label: 'Starpetal',
    word: 'Starpetal',
    colour: '#f2c14e',
    trait: 'glitter',
    effect: 'sparkling',
    lore: 'Starpetals only open after dark.',
  },
  {
    id: 'emberroot',
    label: 'Emberroot',
    word: 'Emberroot',
    colour: '#e2562b',
    trait: 'glow',
    effect: 'glowing',
    lore: 'Emberroot stays warm long after it is dug up.',
  },
  {
    id: 'bluebell',
    label: 'Bluebell dew',
    word: 'Bluebell',
    colour: '#5b8def',
    trait: 'clear',
    effect: 'floating',
    lore: 'Bluebell dew is gathered before the birds wake up.',
  },
  {
    id: 'rosehip',
    label: 'Rosehip syrup',
    word: 'Rosehip',
    colour: '#d9467a',
    trait: 'swirl',
    effect: 'whirling',
    lore: 'Rosehip syrup stirs itself if you hum to it.',
  },
  {
    id: 'thundercloud',
    label: 'Thundercloud',
    word: 'Thundercloud',
    colour: '#4b3f8f',
    trait: 'glitter',
    effect: 'whirling',
    lore: 'Thundercloud rumbles when it is cross.',
  },
  {
    id: 'snailshine',
    label: 'Snailshine',
    word: 'Snailshine',
    colour: '#7fd6c8',
    trait: 'swirl',
    effect: 'sparkling',
    lore: 'Snailshine is the silver trail a snail leaves on a wet night.',
  },
  {
    id: 'bogmurk',
    label: 'Bog murk',
    word: 'Bogmurk',
    colour: '#6b5b33',
    trait: 'cloud',
    effect: 'whiffy',
    lore: 'Bog murk is the best bit of the pond.',
  },
]

export function ingredient(id: IngredientId): Ingredient {
  return INGREDIENTS.find((i) => i.id === id)!
}

/** Murk is only ever this one ingredient, at the same odds as any other. */
export const MURK: IngredientId = 'bogmurk'
