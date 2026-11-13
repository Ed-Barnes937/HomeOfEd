/** Potion names from games and stories that a potion here must never take or mention. */
export const POTION_DO_NOT_USE = [
  'Polyjuice',
  'Felix Felicis',
  'Liquid Luck',
  'Amortentia',
  'Veritaserum',
  'Wolfsbane',
  'Skele-Gro',
  'Pepperup',
  'Draught of Living Death',
  'Draught of Peace',
  'Sleeping Draught',
  'Dreamless Sleep',
  'Calming Draught',
  'Shrinking Solution',
  'Swelling Solution',
  'Babbling Beverage',
  'Wit-Sharpening',
  'Gillyweed',
  'Butterbeer',
  'Pumpkin Juice',
  'Thunderbrew',
  'Wiggenweld',
  'Edurus',
  'Maxima',
  'Elixir of Life',
  "Philosopher's Stone",
  'Fizzing Whizzbees',
  'Estus',
  'Hi-Potion',
  'X-Potion',
  'Mega-Potion',
  'Super Potion',
  'Hyper Potion',
  'Max Potion',
  'Full Restore',
  'Elixir',
  'Max Elixir',
  'Ether',
  'Phoenix Down',
  'Red Potion',
  'Blue Potion',
  'Green Potion',
  'Purple Potion',
  'Skooma',
  'Awkward Potion',
  'Mundane Potion',
  'Thick Potion',
  'Swallow',
  'Thunderbolt',
  'Tawny Owl',
  'White Honey',
  'Golden Oriole',
  'Black Blood',
  "Petri's Philter",
  'Health Potion',
  'Mana',
  'Mana Potion',
  'Stamina Potion',
  'HP',
  'MP',
  'Ambrosia',
  'Soma',
  'Mead of Poetry',
  'Drink Me',
] as const

const joined = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

const BANNED = POTION_DO_NOT_USE.map(joined)
const COINAGE_LENGTH = 9

const PATTERNS = [
  /^(potion|draught|elixir) of\b/,
  /^phil(ter|tre)/,
  /(^|[^a-z])(super|hyper|max|mega|hi|x)[\s-]*potion/,
]

/** True for a name that is, or opens with, one of the listed names or patterns. */
export function isForbiddenName(name: string): boolean {
  const squashed = joined(name)
  if (BANNED.includes(squashed)) return true
  // Long entries are distinctive coinages, so they count inside a longer name; short ones are common words.
  if (BANNED.some((entry) => entry.length >= COINAGE_LENGTH && squashed.includes(entry)))
    return true
  const spaced = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return PATTERNS.some((pattern) => pattern.test(spaced))
}
