import type { Params } from '../engine/schema.ts'

const NUMBER_WORDS = ['Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen']
const QUARTERS = ['', ' and a quarter', ' and a half', ' and three quarter']

export const cmToInches = (cm: number) => cm / 2.54

export function inchesInWords(cm: number): string {
  const quarters = Math.round(cmToInches(cm) * 4)
  const whole = Math.floor(quarters / 4)
  return `${NUMBER_WORDS[whole - 11] ?? String(whole)}${QUARTERS[quarters % 4]} inches`
}

const STAIN_WORDS: Record<string, string> = {
  smoky: 'Smoky',
  midnight: 'Midnight',
  ember: 'Ember',
  forest: 'Green',
  ocean: 'Sea',
  plum: 'Plum',
}

const SHAFT_NOUNS: Record<string, string> = {
  shortSpiral: 'Spiral',
  longSpiral: 'Climber',
  twistedFacets: 'Twist',
}

const HANDLE_NOUNS: Record<string, string> = {
  diamonds: 'Gem',
  spiralFlutes: 'Swirl',
  flutes: 'Ridge',
}

const CORE_NOUNS: Record<string, string> = {
  starlight: 'Star',
  moonstone: 'Moon',
  wildwood: 'Sprout',
  stormglass: 'Storm',
  emberstone: 'Spark',
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function wandName(p: Params): string {
  const colour = STAIN_WORDS[p.stainColour as string] ?? capitalise(p.wood as string)
  const noun =
    SHAFT_NOUNS[p.shaftCarving as string] ??
    HANDLE_NOUNS[p.handleCarving as string] ??
    CORE_NOUNS[p.core as string] ??
    'Wand'
  return `The ${colour} ${noun}`
}

/** FNV-1a over the params in key order, so the same wand always has the same number. */
export function wandNumber(p: Params): string {
  const text = Object.keys(p)
    .sort()
    .map((k) => `${k}=${p[k]}`)
    .join('&')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return String((hash % 9999) + 1).padStart(4, '0')
}

const CORE_NAMES: Record<string, string> = {
  starlight: 'Starlight',
  moonstone: 'Moonstone',
  wildwood: 'Wildwood',
  stormglass: 'Storm glass',
  emberstone: 'Emberstone',
}

export const coreName = (core: string) => CORE_NAMES[core] ?? capitalise(core)

function feel(p: Params): string {
  const thickness = p.thickness as number
  if (thickness <= 0.93) return 'Slender'
  if (thickness >= 1.07) return 'Sturdy'
  if ((p.pointy as number) >= 0.5) return 'Springy'
  return 'Steady'
}

export function wandDescription(p: Params): string {
  const length = inchesInWords(p.lengthCm as number)
  return `${length}, ${p.wood as string}, ${coreName(p.core as string).toLowerCase()} core. ${feel(p)}.`
}

const WOOD_LORE: Record<string, string> = {
  cherry: 'Cherry is warm-hearted and makes friends fast.',
  walnut: 'Walnut is clever and keeps secrets.',
  oak: 'Oak is brave and patient.',
  maple: 'Maple is curious and loves a puzzle.',
}

const CORE_LORE: Record<string, string> = {
  starlight: 'Casts gold light that always finds the way home.',
  moonstone: 'Casts a cool silver-blue and stays calm when things get loud.',
  wildwood: 'Casts green light, and small things grow wherever it points.',
  stormglass: 'Casts violet light. A little unpredictable, never boring.',
  emberstone: 'Casts a warm orange light and is quick to spark.',
}

export const woodLore = (wood: string) => WOOD_LORE[wood] ?? ''
export const coreLore = (core: string) => CORE_LORE[core] ?? ''

export function wandLore(p: Params): string {
  const core = coreLore(p.core as string)
  const coreLine = `${coreName(p.core as string)} ${core.charAt(0).toLowerCase()}${core.slice(1)}`
  return `${woodLore(p.wood as string)} ${coreLine}`
}
