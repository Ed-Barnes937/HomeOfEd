import type { Params } from '../engine/schema.ts'
import { secretBlend } from './blends.ts'
import { BOTTLES, type BottleRow, type ShapeId } from './bottles.ts'
import { isForbiddenName } from './doNotUse.ts'
import { EFFECTS, potionEffect } from './effects.ts'
import { ingredient, type IngredientId, type Trait } from './ingredients.ts'
import { pourList } from './pours.ts'

export { shopNumber as potionNumber } from '../items/shopNumber.ts'

const CANDLE = '#e8b46a'
const COUNT_WORDS = ['One pour', 'Two pours', 'Three pours', 'Four pours']
const TRAIT_WORDS: Record<Trait, string> = {
  clear: 'clear',
  cloud: 'cloudy',
  fizz: 'fizzy',
  glitter: 'sparkly',
  glow: 'glowing',
  swirl: 'swirly',
}

export function countInWords(n: number): string {
  return COUNT_WORDS[n - 1] ?? `${n} pours`
}

const bottleOf = (p: Params): BottleRow => BOTTLES[p.shape as ShapeId] ?? BOTTLES.teardrop

const capitalised = (text: string) =>
  text.replace(/(^|\s)([a-z])/g, (_match, space: string, c: string) => space + c.toUpperCase())

/** The most poured ingredient, a tie going to the highest pour. */
function mainIngredient(pours: readonly IngredientId[]): IngredientId {
  let main = pours[pours.length - 1]!
  const count = (id: IngredientId) => pours.filter((x) => x === id).length
  for (let i = pours.length - 1; i >= 0; i--) if (count(pours[i]!) > count(main)) main = pours[i]!
  return main
}

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
    `${effectWord} ${word} ${BOTTLES.round.nameNoun}`,
    `${capitalised(label)} ${noun}`,
  ]
  return candidates.find((name) => !forbidden(name)) ?? candidates[candidates.length - 1]!
}

export function potionName(p: Params): string {
  const blend = secretBlend(p)
  if (blend) return blend.name
  const pours = pourList(p)
  if (pours.length === 0) return 'An Empty Bottle'
  const main = ingredient(mainIngredient(pours))
  if (pours.length > 1 && pours.every((id) => id === pours[0]))
    return `Pure ${capitalised(main.label)}`
  const { word } = EFFECTS[potionEffect(p)!.kind]
  return nameFrom(word, main.word, main.label, bottleOf(p).nameNoun)
}

export function potionTagLine(p: Params): string {
  const { noun } = bottleOf(p)
  const pours = pourList(p)
  if (pours.length === 0) return `An empty ${noun}, waiting for a pour.`
  const traits = pours
    .map((id) => TRAIT_WORDS[ingredient(id).trait])
    .filter((word, i, all) => word !== all[i - 1])
  const phrase = traits.join(', then ')
  return `${countInWords(pours.length)} in a ${noun}. ${phrase[0]!.toUpperCase()}${phrase.slice(1)}.`
}

export function potionLore(p: Params): string {
  const blend = secretBlend(p)
  if (blend) return blend.lore
  const pours = pourList(p)
  if (pours.length === 0) return 'Every potion starts as an empty bottle. Pour something in.'
  return `${ingredient(mainIngredient(pours)).lore} ${EFFECTS[potionEffect(p)!.kind].sentence}`
}

export function potionShelfLine(p: Params): string {
  const { label } = bottleOf(p)
  const count = pourList(p).length
  return count === 0 ? `${label}, empty` : `${label}, ${countInWords(count).toLowerCase()}`
}

export function potionGlowColour(p: Params): string {
  return potionEffect(p)?.colours[0] ?? CANDLE
}
