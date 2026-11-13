import type { Params } from '../engine/schema.ts'
import { secretBlend } from './blends.ts'
import { BOTTLES, type BottleRow, type ShapeId } from './bottles.ts'
import { isForbiddenName } from './doNotUse.ts'
import { EFFECTS, potionEffect } from './effects.ts'
import { ingredient, type IngredientId, type Trait } from './ingredients.ts'
import { potionMix } from './mix.ts'
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

export function potionTagLine(p: Params): string {
  const { noun } = bottleOf(p)
  const pours = pourList(p)
  if (pours.length === 0) return `An empty ${noun}, waiting for three ingredients.`
  if (isMixed(p))
    return `Mixed from ${joinWords(pours.map((id) => ingredient(id).word))} in a ${noun}.`
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
