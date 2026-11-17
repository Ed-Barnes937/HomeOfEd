import type { Params } from '../engine/schema.ts'
import { secretBlend } from './blends.ts'
import { BOTTLES, type BottleRow, type ShapeId } from './bottles.ts'
import { isForbiddenName } from './doNotUse.ts'
import { EFFECTS, potionEffect } from './effects.ts'
import { ingredient, type EffectKind, type IngredientId, type Trait } from './ingredients.ts'
import { mixPotion, potionMix, type PotionMix, type Recipe } from './mix.ts'
import { isMixed } from './potionSchema.ts'
import { pourList } from './pours.ts'

export { shopNumber as potionNumber } from '../items/shopNumber.ts'

const CANDLE = '#e8b46a'
const LAYER_WORDS = ['One layer', 'Two layers', 'Three layers']
const MORE_WORDS = ['two more', 'one more']
const TRAIT_WORDS: Record<Trait, string> = {
  clear: 'clear',
  cloud: 'cloudy',
  fizz: 'fizzy',
  glitter: 'sparkly',
  glow: 'glowing',
  swirl: 'swirly',
  murk: 'murky',
}
const WHAT_IT_DOES: Record<EffectKind, readonly [string, string, string]> = {
  floating: [
    'One dab on each shoe and you float a finger above the floor',
    'One dab on each shoe and you float as high as the table',
    'One dab on each shoe and you bob along the ceiling like a balloon',
  ],
  sparkling: [
    'A drop on your hands and everything you touch twinkles',
    'A drop on your hands and everything you touch is covered in glitter',
    'A drop on your hands and glitter follows you about like a tail',
  ],
  dreamy: [
    'A drop on your pillow and you dream of somewhere nice',
    'A drop on your pillow and you dream whatever dream you ask for',
    'A drop on your pillow and you share a dream with your best friend',
  ],
  glowing: [
    'A dab on your nose and it glows like a night light',
    'A dab on your nose and you glow enough to read under the covers',
    'A dab on your nose and you glow so brightly that moths come to visit',
  ],
  whirling: [
    'A splash on the floor and you spin once round, very neatly',
    'A splash on the floor and you twirl like a leaf in the wind',
    'A splash on the floor and you whirl so fast your hat flies off',
  ],
  whiffy: [
    'Pull the cork and the room smells a little of cabbage',
    'Pull the cork and the room smells of wet dog and cabbage',
    'Pull the cork and the pong is so strong that even the flies leave',
  ],
}
const LASTS_UNTIL: Record<IngredientId, string> = {
  emberroot: 'until your toes get cold',
  starpetal: 'until the sun comes up',
  frogfizz: 'until a frog croaks',
  snailshine: 'until it rains',
  bluebell: 'until the birds wake up',
  thundercloud: 'until the next clap of thunder',
  moonmilk: 'until the moon goes in',
  rosehip: 'until somebody hums a lullaby',
  puffcap: 'until you sneeze',
}
const LEAVES_YOU_WITH: Record<IngredientId, { adjective: string; thing: string }> = {
  emberroot: { adjective: 'warm', thing: 'toes' },
  starpetal: { adjective: 'golden', thing: 'freckles' },
  frogfizz: { adjective: 'bouncy', thing: 'hiccups' },
  snailshine: { adjective: 'silvery', thing: 'footprints' },
  bluebell: { adjective: 'dewy', thing: 'eyelashes' },
  thundercloud: { adjective: 'rumbly', thing: 'hair' },
  moonmilk: { adjective: 'sleepy', thing: 'yawns' },
  rosehip: { adjective: 'rosy', thing: 'cheeks' },
  puffcap: { adjective: 'spotty', thing: 'elbows' },
}
const NAME_NOUNS: Record<ShapeId, string> = {
  round: 'Brew',
  teardrop: 'Potion',
  tall: 'Essence',
  shoulder: 'Wonder',
  gourd: 'Swirl',
}
const MURKY_NAMES = [
  'A Marvellous Muddle',
  'Bottled Bog',
  "Frog's Bathwater",
  'Swampy Surprise',
  'Grumbling Gloop',
  'Muddy Wellies',
  'Tadpole Puddle',
]
const MURKY_LORE =
  'Three things that would not get on, swirled into one. It does nothing at all, and it is very proud of that.'

const bottleOf = (p: Params): BottleRow => BOTTLES[p.shape as ShapeId] ?? BOTTLES.teardrop

const capitalised = (text: string) =>
  text.replace(/(^|\s)([a-z])/g, (_match, space: string, c: string) => space + c.toUpperCase())

/** "{Effect} {Word} {Noun}", then the round shape's noun, then "{Label} {Noun}", if a name is forbidden. */
export function nameFrom(
  effectWord: string,
  word: string,
  label: string,
  noun: string,
  forbidden: (name: string) => boolean = isForbiddenName,
): string {
  const candidates = [
    `${effectWord} ${word} ${noun}`,
    `${effectWord} ${word} ${NAME_NOUNS.round}`,
    `${capitalised(label)} ${noun}`,
  ]
  return candidates.find((name) => !forbidden(name)) ?? candidates[candidates.length - 1]!
}

const joinWords = (words: string[]) =>
  words.length < 3
    ? words.join(' and ')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

/** The layers in pour order by word, a repeated word folded into its first place as Double or Triple. */
function layerNames(pours: readonly IngredientId[]): string {
  const words = pours.map((id) => ingredient(id).word)
  const folded = words
    .filter((word, i) => words.indexOf(word) === i)
    .map((word) => {
      const times = words.filter((w) => w === word).length
      return times === 1 ? word : `${times === 2 ? 'Double' : 'Triple'} ${word}`
    })
  return joinWords(folded)
}

export function potionName(p: Params): string {
  const pours = pourList(p)
  if (pours.length === 0) return 'An Empty Bottle'
  if (!isMixed(p)) return layerNames(pours)
  const blend = secretBlend(p)
  if (blend) return blend.name
  const mix = potionMix(p)!
  if (mix.outcome === 'murky') {
    const places = pours.reduce((sum, id) => sum + ingredient(id).wheel, 0)
    return MURKY_NAMES[places % MURKY_NAMES.length]!
  }
  if (pours.every((id) => id === pours[0]))
    return `Pure ${capitalised(ingredient(pours[0]!).label)}`
  const main = ingredient(mix.main!)
  const noun = NAME_NOUNS[p.shape as ShapeId] ?? NAME_NOUNS.teardrop
  return nameFrom(EFFECTS[mix.outcome].word, main.word, main.label, noun)
}

/** The two ingredients left once one of the main is taken out, in wheel order. */
function others(pours: readonly IngredientId[], main: IngredientId): IngredientId[] {
  const rest = [...pours]
  rest.splice(rest.indexOf(main), 1)
  return rest.sort((a, b) => ingredient(a).wheel - ingredient(b).wheel)
}

function whatItDoes(
  pours: readonly IngredientId[],
  outcome: EffectKind,
  mix: PotionMix,
  main: IngredientId,
): string {
  const [x, y] = others(pours, main) as [IngredientId, IngredientId]
  return `${WHAT_IT_DOES[outcome][mix.strength - 1]}, ${LASTS_UNTIL[main]}. It leaves you with ${LEAVES_YOU_WITH[x].adjective} ${LEAVES_YOU_WITH[y].thing}.`
}

export function potionTagLine(p: Params): string {
  const { noun } = bottleOf(p)
  const pours = pourList(p)
  if (pours.length === 0) return `An empty ${noun}, waiting for three ingredients.`
  if (isMixed(p)) {
    const mix = mixPotion(pours as unknown as Recipe)
    if (mix.outcome !== 'murky' && mix.main) return whatItDoes(pours, mix.outcome, mix, mix.main)
    return `Mixed from ${joinWords(pours.map((id) => ingredient(id).word))} in a ${noun}.`
  }
  const traits = pours
    .map((id) => TRAIT_WORDS[ingredient(id).trait])
    .filter((word, i, all) => word !== all[i - 1])
  const phrase = traits.join(', then ')
  return `${LAYER_WORDS[pours.length - 1]} in a ${noun}. ${phrase[0]!.toUpperCase()}${phrase.slice(1)}.`
}

export function potionLore(p: Params): string {
  const pours = pourList(p)
  if (pours.length === 0) return 'Every potion starts as an empty bottle. Pick three ingredients.'
  if (!isMixed(p)) {
    const top = ingredient(pours[pours.length - 1]!).lore
    return pours.length < 3
      ? `${top} It needs ${MORE_WORDS[pours.length - 1]} before it can be mixed.`
      : `${top} Tap the bottle to mix it and see what it does.`
  }
  const blend = secretBlend(p)
  if (blend) return blend.lore
  const mix = potionMix(p)!
  if (mix.outcome === 'murky') return `${MURKY_LORE} ${EFFECTS.murky.sentence}`
  return `${ingredient(mix.main!).lore} ${EFFECTS[mix.outcome].sentence}`
}

export function potionShelfLine(p: Params): string {
  const { label } = bottleOf(p)
  const count = pourList(p).length
  const effect = potionEffect(p)
  if (effect) return `${label}, ${EFFECTS[effect.kind].word.toLowerCase()}`
  return count === 0 ? `${label}, empty` : `${label}, ${LAYER_WORDS[count - 1]!.toLowerCase()}`
}

export function potionGlowColour(p: Params): string {
  const effect = potionEffect(p)
  if (effect) return effect.colours[0]!
  const top = pourList(p).at(-1)
  return top ? ingredient(top).colour : CANDLE
}

/** True only for a mixed secret blend. */
export const isGold = (p: Params): boolean => secretBlend(p) !== null
