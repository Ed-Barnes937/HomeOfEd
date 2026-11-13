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

const BANNED = new Set(POTION_DO_NOT_USE.map(joined))

const PATTERNS = [
  /^(potion|draught|elixir) of\b/,
  /^phil(ter|tre)/,
  /(^|[^a-z])(super|hyper|max|mega|hi|x)[\s-]*potion/,
]

/** True when a run of the name's words is a listed entry (Elixir only as the whole name), or a pattern matches. */
export function isForbiddenName(name: string): boolean {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      const run = words.slice(start, end).join('')
      const wholeName = start === 0 && end === words.length
      if (BANNED.has(run) && (run !== 'elixir' || wholeName)) return true
    }
  }
  return PATTERNS.some((pattern) => pattern.test(words.join(' ')))
}
