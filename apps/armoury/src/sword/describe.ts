import type { Params } from '../engine/schema.ts'
import { coreName } from '../wand/describe.ts'
import { type Family, familyOf, overallLengthMm } from './families.ts'
import { hasGems, hasRunes, hasWaves, swordSwatchFor } from './swordSchema.ts'

/** Names a sword must never take or mention: research 8.4 and 3.3, and a few near misses. */
export const DO_NOT_USE = [
  'Sting',
  'Glamdring',
  'Orcrist',
  'Anduril',
  'Narsil',
  'Barrow-blade',
  'Mithril',
  'Needle',
  'Longclaw',
  'Ice',
  'Oathkeeper',
  "Widow's Wail",
  'Dawn',
  'Lightbringer',
  'Valyrian',
  'Dragonglass',
  'Hedge Knight',
  'Frostmourne',
  'Ashbringer',
  'Silverleaf',
  'Hearthstone',
  'Master Sword',
  'Buster Sword',
  'Keyblade',
  'Lionheart',
  'Soul Edge',
  'Excalibur',
  'Durendal',
  'Kusanagi',
  'Zulfiqar',
  'Witcher',
  'Wolf School',
  'Griffin School',
  'Wolven',
  'Kaer Morhen',
  'Aerondight',
  'Zireael',
  'Sihil',
  'Moonblade',
  'Iris',
  'Gwalhir',
  'Runestone',
  'Runeword',
  'Grey Warden',
  'Grey Pilgrim',
  'Iron Giant',
  'Silverthorn',
  'Golden Rune',
  'Silver Flame',
  'Golden Crescent',
  'Silver Star',
  'Bronze Star',
]

const UNITS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy']

function numberInWords(n: number): string {
  if (n < 20) return UNITS[n] ?? String(n)
  const tens = TENS[Math.floor(n / 10)]
  if (!tens) return String(n)
  return n % 10 === 0 ? tens : `${tens}-${UNITS[n % 10]}`
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Whole and half inches in words, up to seventy: "Thirty-one and a half inches". */
export function lengthInWords(mm: number): string {
  const halves = Math.round((mm / 25.4) * 2)
  const whole = Math.floor(halves / 2)
  return `${capitalise(numberInWords(whole))}${halves % 2 ? ' and a half' : ''} inches`
}

/** Colour words, first match wins: pattern, then steel, then (on satin) the fittings. */
export const SWORD_COLOURS = {
  watered: 'Rippled',
  temper: 'Tide',
  blue: 'Blue',
  dark: 'Night',
  silver: 'Silver',
  bright: 'Bright',
  brassFittings: 'Brass',
  bronzeFittings: 'Bronze',
  goldFittings: 'Golden',
  silverFittings: 'Silver',
  ironFittings: 'Steel',
  darkIronFittings: 'Dusk',
  blueFittings: 'Blue',
} as const

const PATTERN_COLOURS: Record<string, string> = {
  watered: SWORD_COLOURS.watered,
  temper: SWORD_COLOURS.temper,
}
const STEEL_COLOURS: Record<string, string> = {
  blue: SWORD_COLOURS.blue,
  dark: SWORD_COLOURS.dark,
  silver: SWORD_COLOURS.silver,
  bright: SWORD_COLOURS.bright,
}
const FITTINGS_COLOURS: Record<string, string> = {
  brass: SWORD_COLOURS.brassFittings,
  bronze: SWORD_COLOURS.bronzeFittings,
  gold: SWORD_COLOURS.goldFittings,
  silver: SWORD_COLOURS.silverFittings,
  iron: SWORD_COLOURS.ironFittings,
  darkIron: SWORD_COLOURS.darkIronFittings,
  blue: SWORD_COLOURS.blueFittings,
}

export const SWORD_NOUNS = {
  features: { waves: 'Flame', runes: 'Rune', leaf: 'Leaf', flared: 'Crescent', gems: 'Star' },
  kinds: {
    dagger: 'Wren',
    shortSword: 'Badger',
    knight: 'Warden',
    longsword: 'Pilgrim',
    greatsword: 'Giant',
    sabre: 'Swallow',
    katana: 'Heron',
    rapier: 'Quill',
  } satisfies Record<Family, string>,
}

const swordColour = (p: Params) =>
  PATTERN_COLOURS[p.pattern as string] ??
  STEEL_COLOURS[p.steel as string] ??
  FITTINGS_COLOURS[p.fittings as string] ??
  SWORD_COLOURS.ironFittings

function featureNoun(p: Params): string | undefined {
  const { features } = SWORD_NOUNS
  if (hasWaves(p)) return features.waves
  if (hasRunes(p)) return features.runes
  if (p.profile === 'leaf') return features.leaf
  if (p.profile === 'flared') return features.flared
  if (hasGems(p)) return features.gems
  return undefined
}

const joined = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '')
const BORROWED = new Set(DO_NOT_USE.map(joined))

/** "The {Colour} {Noun}", falling back to the Kind's noun if that would borrow a famous name. */
export function nameFrom(colour: string, noun: string, kindNoun: string): string {
  return BORROWED.has(joined(colour + noun)) ? `The ${colour} ${kindNoun}` : `The ${colour} ${noun}`
}

export function swordName(p: Params): string {
  const kindNoun = SWORD_NOUNS.kinds[p.family as Family] ?? SWORD_NOUNS.kinds.knight
  return nameFrom(swordColour(p), featureNoun(p) ?? kindNoun, kindNoun)
}

export { shopNumber as swordNumber } from '../items/shopNumber.ts'

const STEEL_WORDS: Record<string, string> = {
  satin: 'satin',
  bright: 'mirror',
  dark: 'black',
  silver: 'silver',
  blue: 'blue',
}

const FITTINGS_WORDS: Record<string, string> = {
  iron: 'iron',
  darkIron: 'dark iron',
  brass: 'brass',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  blue: 'blue',
}

const steelWord = (p: Params) =>
  p.pattern === 'watered' ? 'rippled' : (STEEL_WORDS[p.steel as string] ?? 'satin')

function feel(p: Params): string {
  if (p.family === 'rapier') return 'Light as a feather'
  if (p.family === 'sabre') return 'Swift'
  const length = p.bladeLength as number
  const width = p.bladeWidth as number
  if (width <= 0.35) return familyOf(p).hands === 2 ? 'Well balanced' : 'Quick in the hand'
  if (length >= 0.6 && width >= 0.6 && p.family !== 'dagger') return 'Mighty'
  return 'Steady'
}

export function swordTagLine(p: Params): string {
  const fittings = FITTINGS_WORDS[p.fittings as string] ?? 'iron'
  return `${lengthInWords(overallLengthMm(p))}, ${steelWord(p)} steel, ${fittings} hilt. ${feel(p)}.`
}

const STEEL_LORE: Record<string, string> = {
  satin: 'Satin steel is patient and does its work without showing off.',
  bright: 'Mirror steel was polished for a whole winter and still remembers every face it saw.',
  dark: 'Black steel came out of the coals and kept a little of the night.',
  blue: 'Blue steel was cooled at exactly the right moment, and it knows it.',
  silver: 'A silver blade is bright, kind and a little bit proud.',
}

const PATTERN_LORE: Record<string, string> = {
  watered: 'Rippled steel is folded from many layers, like a story told many times.',
  temper: 'The temper line is where the soft heart meets the hard edge.',
}

const FITTINGS_LORE: Record<string, string> = {
  iron: 'Iron fittings never complain.',
  darkIron: 'Dark iron fittings keep their secrets.',
  brass: 'Brass fittings are warm and friendly.',
  bronze: 'Bronze fittings are old and steady and have seen a lot of sunrises.',
  silver: 'Silver fittings catch the light and pass it on.',
  gold: 'Gold fittings stand up straight.',
  blue: 'Blue fittings are as calm as deep water.',
}

const RUNE_LORE: Record<string, string> = {
  starlight: 'wake when the way home is needed.',
  moonstone: 'glow blue when someone nearby is being brave.',
  wildwood: 'glow green when something small needs looking after.',
  stormglass: 'glow violet just before an adventure begins.',
  emberstone: 'glow warm whenever a friend is cold.',
}

function runeLine(colour: string): string {
  const line = RUNE_LORE[colour] ?? RUNE_LORE.moonstone!
  return `Its ${coreName(colour).toLowerCase()} runes ${line}`
}

export function swordLore(p: Params): string {
  const metal =
    PATTERN_LORE[p.pattern as string] ?? STEEL_LORE[p.steel as string] ?? STEEL_LORE.satin!
  const second = hasRunes(p)
    ? runeLine(p.runeColour as string)
    : (FITTINGS_LORE[p.fittings as string] ?? FITTINGS_LORE.iron!)
  return `${metal} ${second}`
}

export function swordShelfLine(p: Params): string {
  const inches = lengthInWords(overallLengthMm(p))
  return `${familyOf(p).label}, ${inches.charAt(0).toLowerCase()}${inches.slice(1)}, ${steelWord(p)} steel`
}

const FORGE_EMBER = '#ff8a2a'

/** Its light: the runes' colour (or gems that match them), else the gems' own, else forge ember. */
export function swordGlowColour(p: Params): string {
  const runeColour = swordSwatchFor('runeColour', p.runeColour as string)
  if (hasRunes(p) || (hasGems(p) && p.gemColour === 'runes')) return runeColour ?? FORGE_EMBER
  if (hasGems(p)) return swordSwatchFor('gemColour', p.gemColour as string) ?? FORGE_EMBER
  return FORGE_EMBER
}
