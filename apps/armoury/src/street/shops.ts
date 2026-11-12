import type { ShopPath } from '../landing.ts'

/**
 * The street's painting, served from `public/`, lit and with every light off. `width` and `height`
 * are the drawing's coordinate space, which every outline uses; a sharper file of the same shape
 * needs no retracing.
 */
export const STREET_PAINTING = {
  src: '/street/street.webp',
  dark: '/street/street-dark.webp',
  width: 2752,
  height: 1536,
}

export interface StreetShop {
  id: string
  /** The name painted over its window. */
  name: string
  /** Its front traced as one closed SVG path: absolute M, L, Q and C only, ending in Z. */
  outline: string
  /** Where its light reaches past its front once open, as closed paths like `outline`. */
  spill?: readonly string[]
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
    outline:
      'M 0,1536 L 0,228 L 77,223 L 100,215 L 100,100 L 83,98 L 83,66 L 127,62 L 127,0 L 162,0 L 162,62 L 181,62 L 181,12 L 219,12 L 219,64 L 246,66 L 246,98 L 231,100 L 231,185 L 346,138 L 462,85 L 538,46 L 577,23 L 604,31 L 615,123 L 638,200 L 669,285 L 700,354 L 738,431 L 777,500 L 790,532 L 782,548 L 722,560 L 718,1165 L 692,1200 L 677,1320 L 600,1320 L 600,1365 L 560,1410 L 520,1418 L 420,1410 L 400,1488 L 300,1494 L 190,1494 L 172,1536 Z',
    to: '/wands',
  },
  {
    id: 'smithy',
    name: 'The Ember Anvil',
    outline:
      'M 2140,1312 L 2140,853 L 2082,792 L 2190,660 L 2293,524 L 2322,510 L 2322,303 L 2303,300 L 2303,245 L 2493,208 L 2593,240 L 2593,303 L 2577,305 L 2577,466 L 2752,497 L 2752,1440 L 2600,1395 L 2570,1400 L 2572,1460 L 2560,1470 L 2400,1470 L 2392,1455 L 2420,1405 L 2418,1365 L 2405,1328 L 2372,1290 L 2365,1312 Z',
    spill: [
      'M 2340,250 L 2330,120 L 2380,20 L 2460,0 L 2700,0 L 2730,90 L 2650,200 L 2593,240 Z',
      'M 1990,1536 L 2010,1330 L 2140,1300 L 2365,1312 L 2400,1470 L 2752,1440 L 2752,1536 Z',
    ],
    to: '/swords',
  },
  {
    id: 'bows',
    name: 'Yew & Feather',
    outline:
      'M 718,1165 L 722,560 L 782,548 L 790,532 L 777,500 L 738,431 L 722,398 L 780,386 L 828,378 L 868,368 L 896,356 L 906,350 L 917,354 L 954,403 L 996,508 L 1027,614 L 1050,700 L 1040,712 L 1027,729 L 1017,1080 L 1010,1105 L 900,1118 L 890,1170 L 790,1175 L 754,1172 Z',
  },
  {
    id: 'staffs',
    name: 'The Crooked Staff',
    outline:
      'M 917,354 L 906,350 L 902,346 L 908,310 L 914,270 L 918,254 L 964,250 L 962,178 L 953,172 L 953,152 L 970,147 L 970,113 L 974,109 L 983,109 L 987,113 L 987,143 L 992,140 L 999,144 L 999,124 L 1003,121 L 1012,121 L 1015,124 L 1015,150 L 1030,158 L 1030,172 L 1026,178 L 1026,238 L 1065,218 L 1102,200 L 1138,186 L 1156,177 L 1170,169 L 1178,171 L 1181,178 L 1180,218 L 1180,264 L 1181,300 L 1185,332 L 1190,364 L 1195,391 L 1200,423 L 1206,459 L 1213,495 L 1216,510 L 1192,515 L 1190,1000 L 1150,1025 L 1145,1062 L 1025,1065 L 1017,1080 L 1027,729 L 1040,712 L 1050,700 L 1027,614 L 996,508 L 954,403 Z',
  },
  {
    id: 'potions',
    name: 'Bubble & Brew',
    outline:
      'M 1216,510 L 1206,459 L 1200,423 L 1199,400 L 1219,393 L 1219,355 L 1215,350 L 1215,336 L 1225,333 L 1225,328 L 1228,326 L 1238,326 L 1241,330 L 1242,325 L 1245,322 L 1252,322 L 1255,326 L 1255,333 L 1263,338 L 1263,352 L 1259,356 L 1259,379 L 1322,348 L 1329,343 L 1341,372 L 1356,404 L 1374,443 L 1391,479 L 1409,515 L 1424,543 L 1433,572 L 1412,585 L 1410,912 L 1345,915 L 1340,940 L 1300,955 L 1210,958 L 1190,960 L 1192,515 Z',
  },
  {
    id: 'brooms',
    name: 'Swift Sweeps',
    outline:
      'M 1558,1062 L 1558,822 L 1524,815 L 1530,760 L 1541,744 L 1541,694 L 1547,690 L 1547,580 L 1493,568 L 1499,529 L 1514,482 L 1529,435 L 1541,378 L 1541,360 L 1534,356 L 1534,336 L 1548,324 L 1560,296 L 1578,280 L 1640,288 L 1702,306 L 1715,309 L 1715,260 L 1711,256 L 1711,246 L 1726,238 L 1726,220 L 1729,216 L 1738,216 L 1741,220 L 1741,231 L 1748,233 L 1748,217 L 1751,213 L 1758,213 L 1761,217 L 1761,236 L 1774,241 L 1775,258 L 1773,262 L 1774,314 L 1811,341 L 1786,414 L 1762,473 L 1741,517 L 1750,570 L 1763,617 L 1719,733 L 1700,770 L 1652,800 L 1650,870 L 1697,880 L 1697,1062 Z',
  },
  {
    id: 'robes',
    name: 'Stitch & Starlight',
    outline:
      'M 1702,1067 L 1697,880 L 1650,870 L 1652,800 L 1700,770 L 1719,733 L 1763,617 L 1790,590 L 1819,561 L 1850,590 L 1863,617 L 1869,644 L 1869,733 L 1874,772 L 1874,878 L 1858,890 L 1858,1067 Z',
  },
  {
    id: 'pets',
    name: 'Whiskers & Wings',
    outline:
      'M 1893,1290 L 1880,1100 L 1858,1067 L 1858,890 L 1874,878 L 1874,772 L 1869,733 L 1869,644 L 1863,617 L 1850,590 L 1819,561 L 1790,590 L 1763,617 L 1750,570 L 1741,517 L 1762,473 L 1786,414 L 1806,355 L 1830,296 L 1850,238 L 1855,150 L 1867,145 L 1894,164 L 2086,226 L 2086,165 L 2072,160 L 2072,137 L 2094,128 L 2094,82 L 2098,77 L 2117,77 L 2121,82 L 2121,118 L 2130,120 L 2130,91 L 2134,87 L 2147,87 L 2151,91 L 2151,125 L 2167,131 L 2168,160 L 2166,165 L 2168,251 L 2195,250 L 2218,243 L 2266,293 L 2303,300 L 2322,305 L 2322,510 L 2293,524 L 2133,727 L 2120,880 L 2115,1290 Z',
  },
]

export function outlinePoints(outline: string): [number, number][] {
  const numbers = outline.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
  return numbers.flatMap((x, i): [number, number][] => {
    const y = numbers[i + 1]
    return i % 2 === 0 && y !== undefined ? [[x, y]] : []
  })
}

function span(shop: StreetShop): [number, number] {
  const xs = outlinePoints(shop.outline).map(([x]) => x)
  return [Math.min(...xs), Math.max(...xs)]
}

/** What a shop's light shines through: its front and spill once it is open, nothing before. */
export function lightShapes(shop: StreetShop): string[] {
  return shop.to ? [shop.outline, ...(shop.spill ?? [])] : []
}

/** The open shops, in their order along the street. */
export function signposts(shops: readonly StreetShop[] = SHOPS): StreetShop[] {
  return shops.filter((shop) => shop.to).sort((a, b) => span(a)[0] - span(b)[0])
}

/**
 * Where a view `viewWidth` wide looks along the street to show `shop`: the shop is
 * lined up with the side of the view nearer its own end of the street.
 */
export function openingLeft(shop: StreetShop, viewWidth: number): number {
  const [first, last] = span(shop)
  const left = first + last < STREET_PAINTING.width ? first : last - viewWidth
  return Math.min(Math.max(left, 0), STREET_PAINTING.width - viewWidth)
}
