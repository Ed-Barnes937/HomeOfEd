import type { ShopPath } from '../landing.ts'

/** The street's painting, served from `public/`; outlines are in its pixels. */
export const STREET_PAINTING = {
  src: '/street/street.svg',
  width: 2560,
  height: 1440,
}

export interface StreetShop {
  id: string
  /** The name painted over its window. */
  name: string
  /** Its front traced as one closed SVG path: absolute M, L, Q and C only, ending in Z. */
  outline: string
  /** Where its door leads; a shop with none is not built yet and stays shut. */
  to?: ShopPath
}

export const DOOR_LABELS: Record<ShopPath, string> = {
  '/wands': 'Go into the wand shop',
  '/swords': 'Go into the smithy',
}

export const SHOPS: readonly StreetShop[] = [
  {
    id: 'wands',
    name: 'Thistlewick Wands',
    outline: 'M 990,1330 L 1008,900 L 986,900 L 1138,770 L 1290,900 L 1268,900 L 1250,1330 Z',
    to: '/wands',
  },
  {
    id: 'smithy',
    name: 'The Ember Anvil',
    outline:
      'M 1300,1330 L 1300,980 L 1278,980 L 1455,900 L 1500,920 L 1500,820 L 1560,820 L 1560,947 L 1632,980 L 1610,980 L 1610,1330 Z',
    to: '/swords',
  },
  {
    id: 'bows',
    name: 'Yew & Feather',
    outline: 'M 110,820 L 110,560 L 94,560 L 250,430 L 406,560 L 390,560 L 390,820 Z',
  },
  {
    id: 'staffs',
    name: 'The Crooked Staff',
    outline: 'M 470,820 L 470,470 L 454,470 L 560,330 L 666,470 L 650,470 L 650,820 Z',
  },
  {
    id: 'potions',
    name: 'Bubble & Brew',
    outline: 'M 730,820 L 730,580 L 714,580 Q 845,238 976,580 L 960,580 L 960,820 Z',
  },
  {
    id: 'brooms',
    name: 'Swift Sweeps',
    outline: 'M 1660,820 L 1660,590 L 1644,590 Q 1795,254 1946,590 L 1930,590 L 1930,820 Z',
  },
  {
    id: 'robes',
    name: 'Stitch & Starlight',
    outline: 'M 2000,820 L 2000,570 L 1984,570 L 2120,370 L 2256,570 L 2240,570 L 2240,820 Z',
  },
  {
    id: 'pets',
    name: 'Whiskers & Wings',
    outline: 'M 2310,820 L 2310,580 L 2294,580 L 2400,470 L 2506,580 L 2490,580 L 2490,820 Z',
  },
]

export function outlinePoints(outline: string): [number, number][] {
  const numbers = outline.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
  return numbers.flatMap((x, i): [number, number][] => {
    const y = numbers[i + 1]
    return i % 2 === 0 && y !== undefined ? [[x, y]] : []
  })
}

/** The middle of the open shops, across the painting, where a narrow screen first looks. */
export function openShopsCentreX(): number {
  const xs = SHOPS.filter((shop) => shop.to).flatMap((shop) =>
    outlinePoints(shop.outline).map(([x]) => x),
  )
  return (Math.min(...xs) + Math.max(...xs)) / 2
}
