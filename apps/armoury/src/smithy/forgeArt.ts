import { seededRandom } from '../engine/schema.ts'
import type { Grain } from './grain.ts'

// The smithy's back wall (front-on) and floor (from above), each one seeded SVG that the
// browser rasterises once. The wall's floor line is its bottom edge; the forge sits left of
// centre and the window right of it.

export const WALL_W = 2400
export const WALL_H = 1000
export const FLOOR_W = 2400
export const FLOOR_H = 900
/** The coal bed's middle, in wall units. */
export const COALS = { x: 830, y: 818 }
/** The chalk slate leaning on the wall: its top left, and its lean in degrees. */
export const SLATE = { x: 1326, y: 896, tilt: -4 }
/** The window's middle, in wall units. */
export const WINDOW = { x: 1490, y: 725 }

const r1 = (n: number) => Math.round(n * 10) / 10

/** The grain tiles laid over a w by h drawing in soft light; nothing without them. */
function texture(grain: Grain | null, w: number, h: number): string {
  if (!grain) return ''
  return (
    `<defs><pattern id="fine" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${grain.fine}" width="128" height="128"/></pattern>` +
    `<pattern id="mottle" width="640" height="640" patternUnits="userSpaceOnUse"><image href="${grain.mottle}" width="640" height="640"/></pattern></defs>` +
    `<g style="mix-blend-mode:soft-light" opacity="1"><rect width="${w}" height="${h}" fill="url(#mottle)"/><rect width="${w}" height="${h}" fill="url(#fine)"/></g>`
  )
}
const pick = <T>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length)]!

const STONES = [
  '#3b322b',
  '#433830',
  '#4a3e34',
  '#352d27',
  '#4f4239',
  '#3f3731',
  '#463a2f',
  '#3a3430',
]
const BRICKS = ['#7a4630', '#8a5236', '#6e3f2b', '#5c3424', '#80492f', '#6a3a28']

function stoneWall(rand: () => number, y0: number, y1: number): string {
  let out = ''
  let y = y0
  while (y < y1) {
    const h = 30 + rand() * 20
    let x = -rand() * 80
    while (x < WALL_W) {
      const w = 56 + rand() * 96
      out +=
        `<rect x="${r1(x + 2)}" y="${r1(y + 2)}" width="${r1(w - 4)}" height="${r1(h - 4)}" rx="${r1(4 + rand() * 7)}" fill="${pick(rand, STONES)}"/>` +
        `<path d="M${r1(x + 7)} ${r1(y + 4)} h${r1(w - 16)}" stroke="#ffe6c8" stroke-opacity="${r1(0.03 + rand() * 0.05)}" stroke-width="2"/>` +
        `<path d="M${r1(x + 6)} ${r1(y + h - 4)} h${r1(w - 12)}" stroke="#000" stroke-opacity="0.25" stroke-width="2"/>`
      x += w
    }
    y += h
  }
  return out
}

function bricks(rand: () => number, x0: number, x1: number, y0: number, y1: number): string {
  let out = ''
  let row = 0
  for (let y = y0; y < y1; y += 26, row++) {
    for (let x = x0 - (row % 2 ? 30 : 0); x < x1; x += 60) {
      const left = Math.max(x, x0)
      const right = Math.min(x + 60, x1)
      if (right - left < 6) continue
      out += `<rect x="${left + 1.5}" y="${y + 1.5}" width="${right - left - 3}" height="23" rx="2" fill="${pick(rand, BRICKS)}"/>`
      if (rand() < 0.3)
        out += `<rect x="${left + 4}" y="${y + 4}" width="${r1((right - left) * rand() * 0.6)}" height="${r1(4 + rand() * 10)}" fill="#000" opacity="0.18"/>`
    }
  }
  return out
}

function coalBed(rand: () => number): string {
  const lumps: { y: number; svg: string }[] = []
  for (let i = 0; i < 260; i++) {
    const u = rand() * 2 - 1
    const height = 30 * Math.pow(1 - u * u, 0.8)
    const lift = Math.pow(rand(), 0.8)
    const x = COALS.x + u * 118
    const y = 843 - lift * height
    const heat = 1 - Math.pow(Math.abs(u), 1.4) - lift * 0.3 + (rand() - 0.5) * 0.4
    const crust = rand() < 0.7
    const fill =
      heat > 0.85
        ? pick(rand, ['#ffd27a', '#ffc35e'])
        : heat > 0.62 && !crust
          ? '#ff8a2a'
          : heat > 0.45 && !crust
            ? '#b8400f'
            : heat > 0.4
              ? pick(rand, ['#3a170b', '#4a1d0c', '#2a120a'])
              : rand() < 0.12
                ? '#5e5650'
                : pick(rand, ['#17110e', '#211813', '#120d0b'])
    const edge = heat > 0.4 ? '#ff9a3a' : '#0a0604'
    const rad = 3 + rand() * 4.5
    let d = ''
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rand() * 0.6
      const rr = rad * (0.7 + rand() * 0.5)
      d += `${k ? 'L' : 'M'}${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr * 0.75)}`
    }
    lumps.push({
      y,
      svg: `<path d="${d}Z" fill="${fill}" stroke="${edge}" stroke-opacity="${heat > 0.4 ? 0.85 : 0.5}" stroke-width="${heat > 0.4 ? 1.4 : 1}"/>`,
    })
  }
  lumps.sort((a, b) => a.y - b.y)
  let flames = ''
  for (let i = 0; i < 5; i++) {
    const x = COALS.x - 56 + i * 28 + rand() * 12
    const h = 10 + rand() * 14
    flames += `<path d="M${r1(x - 6)} 826 Q${r1(x - 4)} ${r1(824 - h * 0.6)} ${r1(x + rand() * 6 - 3)} ${r1(824 - h)} Q${r1(x + 5)} ${r1(824 - h * 0.5)} ${r1(x + 6)} 826 Z" fill="url(#flame)" opacity="0.6"/>`
  }
  return (
    `<ellipse cx="${COALS.x}" cy="836" rx="210" ry="58" fill="url(#coalHalo)"/>` +
    `<path d="M706 845 C724 822 770 811 ${COALS.x} 811 C890 811 936 822 954 845 Z" fill="url(#bed)"/>` +
    lumps.map((l) => l.svg).join('') +
    flames
  )
}

function forge(rand: () => number): string {
  const hood = 'M596 728 L1064 728 L1064 714 L918 598 L918 0 L742 0 L742 598 L596 714 Z'
  let hoodBricks = ''
  for (let y = 0; y < 728; y += 26)
    for (let x = 560 + ((y / 26) % 2) * 30; x < 1100; x += 60)
      hoodBricks += `<rect x="${x + 1.5}" y="${y + 1.5}" width="57" height="23" rx="2" fill="${pick(rand, ['#2b1e17', '#33241b', '#261a14', '#3a2a1f'])}"/>`
  let tongs = ''
  for (const [x, len, tilt] of [
    [700, 96, -4],
    [784, 84, 3],
    [940, 100, -2],
  ] as const) {
    tongs +=
      `<g transform="rotate(${tilt} ${x} 862)">` +
      `<path d="M${x - 9} 870 C${x - 12} 852 ${x - 2} 846 ${x + 4} 852 L${x + 2} 866" stroke="#1c1917" stroke-width="4" fill="none"/>` +
      `<path d="M${x + 1} 866 L${x - 7} ${866 + len} M${x + 3} 866 L${x + 8} ${866 + len}" stroke="#1c1917" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M${x - 10} 866 C${x - 12} 854 ${x - 4} 849 ${x + 2} 851" stroke="#ffae6e" stroke-width="1.3" fill="none" opacity="0.6"/>` +
      `<path d="M${x} 868 L${x - 8} ${864 + len}" stroke="#d98a50" stroke-width="1" opacity="0.4"/>` +
      `<circle cx="${x + 2}" cy="874" r="3.5" fill="#2e2824"/></g>`
  }
  return (
    `<path d="${hood}" fill="#24180f"/>` +
    `<g clip-path="url(#hoodClip)">${hoodBricks}</g>` +
    `<path d="${hood}" fill="url(#hoodShade)"/>` +
    `<rect x="650" y="726" width="360" height="118" fill="url(#mouth)"/>` +
    `<g opacity="0.22">${bricks(rand, 650, 1010, 726, 844).replace(/fill="#[0-9a-f]+"/g, 'fill="#000"')}</g>` +
    `<rect x="650" y="726" width="360" height="118" fill="url(#mouthEdges)"/>` +
    `<rect x="592" y="712" width="476" height="18" rx="3" fill="#221d1a"/>` +
    `<path d="M596 729 H1064" stroke="#ff9a52" stroke-width="2.5" opacity="0.7"/>` +
    `<rect x="620" y="842" width="420" height="158" fill="#5c3424"/>` +
    bricks(rand, 620, 1040, 848, 1000) +
    `<rect x="620" y="842" width="420" height="158" fill="url(#hearthShade)"/>` +
    `<rect x="612" y="834" width="436" height="16" rx="4" fill="#6b3d27"/>` +
    `<path d="M616 835 H1044" stroke="#ffb072" stroke-width="2" opacity="0.65"/>` +
    coalBed(rand) +
    `<path d="M628 862 H1032" stroke="#181513" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M628 860 H1032" stroke="#e08d52" stroke-width="1.2" opacity="0.5"/>` +
    tongs
  )
}

function bellows(): string {
  return (
    `<path d="M430 700 L452 812" stroke="#3a281b" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M430 548 L430 700" stroke="#8c7350" stroke-width="2.5"/>` +
    `<path d="M604 846 C566 798 478 772 446 812 C430 842 452 884 486 892 C528 902 574 882 604 858 Z" fill="#43291a"/>` +
    `<path d="M592 846 C556 812 488 792 462 818 M584 852 C548 824 490 812 468 836 M580 856 C546 846 494 846 470 860" stroke="#21130b" stroke-width="3" fill="none" opacity="0.8"/>` +
    `<path d="M604 846 C566 798 478 772 446 812" stroke="#6b4a30" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M604 858 C574 882 528 902 486 892" stroke="#4e3522" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `<path d="M448 808 C470 784 540 790 590 832" stroke="#b07a52" stroke-width="1.5" fill="none" opacity="0.5"/>` +
    `<rect x="600" y="844" width="32" height="12" rx="3" fill="#24201d"/>` +
    `<rect x="458" y="944" width="64" height="56" rx="4" fill="#4a3324"/>` +
    `<path d="M460 958 H520 M460 986 H520" stroke="#1e1a17" stroke-width="5"/>` +
    `<ellipse cx="490" cy="945" rx="32" ry="6" fill="#120e0c"/>`
  )
}

function hammers(): string {
  const hammer = (x: number, head: 'cross' | 'ball' | 'small') => {
    const w = head === 'small' ? 34 : 50
    const h = head === 'small' ? 13 : 17
    const end =
      head === 'cross'
        ? `<path d="M${x + w / 2} 710 l14 ${h / 2 - 2} v4 l-14 ${h / 2 - 2} Z" fill="#57504a"/>`
        : head === 'ball'
          ? `<circle cx="${x + w / 2 + 6}" cy="${710 + h / 2}" r="${h / 2 + 1}" fill="#57504a"/>`
          : ''
    return (
      `<rect x="${x - 4.5}" y="718" width="9" height="${head === 'small' ? 92 : 122}" rx="4" fill="url(#handle)"/>` +
      `<rect x="${x - w / 2}" y="710" width="${w}" height="${h}" rx="3" fill="#57504a"/>${end}` +
      `<path d="M${x - w / 2 + 2} 711.5 h${w * 0.6}" stroke="#f0a86c" stroke-width="2" opacity="0.8"/>`
    )
  }
  return (
    `<rect x="1076" y="680" width="196" height="16" rx="2" fill="#4a3324"/>` +
    `<path d="M1100 696 v14 M1124 696 v14 M1164 696 v14 M1188 696 v14 M1226 696 v14 M1246 696 v14" stroke="#2a1d14" stroke-width="4"/>` +
    `<path d="M1076 681 h196" stroke="#c89060" stroke-width="1.2" opacity="0.4"/>` +
    hammer(1112, 'cross') +
    hammer(1176, 'ball') +
    hammer(1236, 'small') +
    `<path d="M1312 1000 L1278 790" stroke="#5a3d22" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M1309 998 L1276 792" stroke="#a87a50" stroke-width="2" opacity="0.4"/>` +
    `<rect x="1276" y="968" width="76" height="30" rx="4" fill="#211e1b" transform="rotate(-8 1314 983)"/>`
  )
}

function horseshoe(x: number, y: number, tilt: number): string {
  return (
    `<g transform="rotate(${tilt} ${x} ${y})">` +
    `<path d="M${x - 16} ${y - 18} L${x - 17} ${y} A17 17 0 0 0 ${x + 17} ${y} L${x + 16} ${y - 18}" stroke="#4a433e" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `<path d="M${x - 19} ${y - 2} A19 19 0 0 0 ${x + 2} ${y + 18.5}" stroke="#d8955c" stroke-width="1.4" fill="none" opacity="0.5"/>` +
    `<circle cx="${x}" cy="${y - 24}" r="2" fill="#5b5550"/></g>`
  )
}

function lantern(x: number): string {
  return (
    `<circle cx="${x}" cy="628" r="90" fill="url(#lanternHalo)"/>` +
    `<path d="M${x} 500 V598" stroke="#2a2420" stroke-width="2"/>` +
    `<path d="M${x - 16} 606 L${x} 594 L${x + 16} 606 Z" fill="#6b5130"/>` +
    `<rect x="${x - 13}" y="606" width="26" height="40" fill="url(#lanternGlass)"/>` +
    `<path d="M${x - 13} 606 V646 M${x + 13} 606 V646 M${x} 606 V646" stroke="#4a3822" stroke-width="2.5"/>` +
    `<rect x="${x - 16}" y="645" width="32" height="6" rx="2" fill="#6b5130"/>`
  )
}

function windowArt(rand: () => number): string {
  const x0 = 1394
  const y0 = 604
  const cols = 3
  const rows = 4
  const pw = 56
  const ph = 33.5
  let panes = ''
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = x0 + 6 + c * (pw + 7)
      const y = y0 + 6 + r * (ph + 6)
      panes +=
        `<rect x="${x}" y="${r1(y)}" width="${pw}" height="${ph}" fill="url(#pane)" opacity="${r1(0.82 + rand() * 0.18)}"/>` +
        `<path d="M${x + 6} ${r1(y + ph - 4)} L${x + 20} ${r1(y + 4)}" stroke="#fff" stroke-opacity="${r1(0.12 + rand() * 0.18)}" stroke-width="3"/>`
    }
  return (
    `<ellipse cx="${WINDOW.x}" cy="${WINDOW.y - 40}" rx="230" ry="190" fill="url(#windowHalo)"/>` +
    `<rect x="1374" y="588" width="232" height="196" rx="4" fill="#4b4c4e"/>` +
    `<path d="M1374 588 L1394 604 L1394 766 L1374 784 Z" fill="#6a6d70"/>` +
    `<path d="M1606 588 L1586 604 L1586 766 L1606 784 Z" fill="#2e2f31"/>` +
    `<rect x="1394" y="604" width="192" height="162" fill="#2a2119"/>` +
    panes +
    `<path d="M1398 750 C1430 730 1450 742 1478 716 C1500 696 1520 704 1540 690 M1470 724 C1480 706 1496 700 1500 688" stroke="#5d7088" stroke-width="3" fill="none" opacity="0.45"/>` +
    `<rect x="1370" y="772" width="240" height="13" rx="2" fill="#5c5d5f"/>` +
    `<path d="M1372 773 H1608" stroke="#dbe6f5" stroke-width="1.5" opacity="0.5"/>` +
    `<path d="M1550 772 L1546 752 H1574 L1570 772 Z" fill="#8a4f33"/>` +
    `<path d="M1560 752 C1554 736 1548 734 1542 728 M1560 752 C1562 732 1570 728 1576 722 M1560 752 C1566 742 1580 742 1586 738" stroke="#4f6b45" stroke-width="3" fill="none" stroke-linecap="round"/>`
  )
}

function slate(rand: () => number): string {
  const { x, y, tilt } = SLATE
  let chalk = ''
  for (let i = 0; i < 4; i++) {
    const ly = y + 40 + i * 11
    const len = 34 + rand() * 40
    let d = `M${x + 16} ${ly}`
    for (let k = 0; k < len; k += 5) d += ` l5 ${r1((rand() - 0.5) * 3)}`
    chalk += `<path d="${d}" stroke="#e8e6df" stroke-opacity="${r1(0.4 + rand() * 0.25)}" stroke-width="1.5" fill="none"/>`
  }
  return (
    `<g transform="rotate(${tilt} ${x + 55} ${y + 92})">` +
    `<rect x="${x + 8}" y="${y + 88}" width="100" height="8" fill="#000" opacity="0.5" filter="url(#softWall)"/>` +
    `<rect x="${x}" y="${y}" width="110" height="92" rx="3" fill="#5a3d26"/>` +
    `<path d="M${x + 2} ${y + 1.5} h106" stroke="#c48a58" stroke-width="1.5" opacity="0.5"/>` +
    `<rect x="${x + 7}" y="${y + 7}" width="96" height="78" fill="#25282b"/>` +
    `<rect x="${x + 7}" y="${y + 7}" width="96" height="78" fill="#fff" opacity="0.05"/>` +
    chalk +
    `<path d="M${x + 76} ${y + 74} l6 -8 l6 8 M${x + 79} ${y + 70} h6" stroke="#e8e6df" stroke-opacity="0.5" stroke-width="1.4" fill="none"/>` +
    `</g>`
  )
}

function barrel(): string {
  let staves = ''
  for (let i = 1; i < 7; i++) {
    const x = 1446 + i * 18
    staves += `<path d="M${x} 884 Q${x + (x - 1510) * 0.08} 940 ${x} 998" stroke="#1d140d" stroke-width="2" fill="none" opacity="0.7"/>`
  }
  return (
    `<path d="M1446 882 Q1434 940 1450 1000 L1570 1000 Q1586 940 1574 882 Z" fill="url(#barrel)"/>` +
    staves +
    `<path d="M1442 906 Q1510 916 1578 906 M1442 976 Q1510 986 1578 976" stroke="#24211e" stroke-width="7" fill="none"/>` +
    `<path d="M1443 903 Q1470 908 1490 909 M1443 973 Q1470 978 1490 979" stroke="#d48a52" stroke-width="1.4" fill="none" opacity="0.5"/>` +
    `<ellipse cx="1510" cy="882" rx="64" ry="10" fill="#5a3d26"/>` +
    `<ellipse cx="1510" cy="883" rx="56" ry="7" fill="#0b1115"/>` +
    `<path d="M1520 881 Q1538 879 1552 882" stroke="#b9d3f2" stroke-width="1.5" fill="none" opacity="0.7"/>`
  )
}

function cat(): string {
  const stripes = [990, 1004, 1018, 1032]
    .map((x) => `M${x} ${812 + (x - 990) * 0.05} C${x + 6} 822 ${x + 4} 834 ${x - 2} 842`)
    .join(' ')
  return (
    `<ellipse cx="1004" cy="846" rx="50" ry="6" fill="#000" opacity="0.45"/>` +
    `<path d="M968 842 C962 818 984 806 1010 806 C1040 806 1056 822 1052 842 Z" fill="url(#cat)"/>` +
    `<path d="${stripes}" stroke="#4a2614" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>` +
    `<path d="M1052 840 C1056 848 1030 850 1004 848 C988 847 978 846 972 842" stroke="#7a4424" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<path d="M1040 846 C1030 848 1018 849 1006 848" stroke="#2e180c" stroke-width="2" fill="none" opacity="0.5"/>` +
    `<path d="M962 824 L960 801 L975 815 Z M981 813 L994 800 L994 822 Z" fill="#b0683a"/>` +
    `<path d="M963 820 L962 807 L971 816 Z M985 814 L992 806 L992 818 Z" fill="#d89a7a" opacity="0.7"/>` +
    `<ellipse cx="978" cy="830" rx="18" ry="15" fill="url(#cat)"/>` +
    `<path d="M967 830 q4 3 8 0 M982 830 q4 3 8 0" stroke="#1a0f08" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M976.5 835 l2 2 l2 -2 Z" fill="#c9786a"/>` +
    `<path d="M962 822 C966 812 974 808 984 810 M996 808 C1012 804 1030 806 1042 814" stroke="#ffbe86" stroke-width="2" fill="none" opacity="0.75" stroke-linecap="round"/>`
  )
}

function bladeRack(): string {
  let blades = ''
  for (let i = 0; i < 6; i++) {
    const x = 1850 + i * 36
    blades +=
      `<path d="M${x - 5} 930 L${x - 4} ${740 + i * 6} L${x} ${724 + i * 6} L${x + 4} ${740 + i * 6} L${x + 5} 930 Z" fill="#2e3136"/>` +
      `<path d="M${x + 3} 928 L${x + 3} ${742 + i * 6}" stroke="#9fb4cc" stroke-width="1" opacity="0.35"/>` +
      `<rect x="${x - 14}" y="930" width="28" height="5" rx="2" fill="#3a2a1c"/>` +
      `<rect x="${x - 3}" y="935" width="6" height="40" fill="#3b261a"/>`
  }
  return (
    `<rect x="1824" y="900" width="240" height="12" fill="#3a2a1c"/>` +
    `<rect x="1824" y="972" width="240" height="14" fill="#3a2a1c"/>` +
    blades
  )
}

function barStock(): string {
  let bars = ''
  for (let i = 0; i < 6; i++)
    bars += `<path d="M${330 + i * 9} 1000 L${352 + i * 11} ${770 + i * 7}" stroke="#25211e" stroke-width="${5 + (i % 2) * 2}"/>`
  return bars + `<path d="M330 1000 L352 770" stroke="#d48a52" stroke-width="1" opacity="0.4"/>`
}

/** The back wall: stone below a timber beam, the forge, its tools and the window. */
export function wallSvg(grain: Grain | null): string {
  const rand = seededRandom(31337)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WALL_W}" height="${WALL_H}" viewBox="0 0 ${WALL_W} ${WALL_H}">` +
    `<defs>` +
    `<filter id="softWall"><feGaussianBlur stdDeviation="4"/></filter>` +
    `<clipPath id="hoodClip"><path d="M596 728 L1064 728 L1064 714 L918 598 L918 0 L742 0 L742 598 L596 714 Z"/></clipPath>` +
    `<linearGradient id="hoodShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0806" stop-opacity="0.85"/><stop offset="0.82" stop-color="#0c0806" stop-opacity="0.6"/><stop offset="0.95" stop-color="#ff8a3a" stop-opacity="0.12"/><stop offset="1" stop-color="#ffaa5a" stop-opacity="0.4"/></linearGradient>` +
    `<radialGradient id="mouth" cx="${COALS.x}" cy="850" r="250" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbe72"/><stop offset="0.28" stop-color="#e0722e"/><stop offset="0.6" stop-color="#7a2e14"/><stop offset="1" stop-color="#26110a"/></radialGradient>` +
    `<linearGradient id="mouthEdges" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.18" stop-color="#000" stop-opacity="0"/><stop offset="0.82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>` +
    `<linearGradient id="hearthShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a52" stop-opacity="0.12"/><stop offset="0.25" stop-color="#000" stop-opacity="0.2"/><stop offset="1" stop-color="#000" stop-opacity="0.72"/></linearGradient>` +
    `<radialGradient id="bed" cx="${COALS.x}" cy="840" r="150" gradientUnits="userSpaceOnUse" gradientTransform="translate(${COALS.x} 840) scale(1 0.35) translate(${-COALS.x} -840)"><stop offset="0" stop-color="#ffe39a"/><stop offset="0.35" stop-color="#ff9a36"/><stop offset="0.7" stop-color="#b8400f"/><stop offset="1" stop-color="#3a160a"/></radialGradient>` +
    `<radialGradient id="coalHalo"><stop offset="0" stop-color="#ffb35a" stop-opacity="0.7"/><stop offset="0.5" stop-color="#ff7a2a" stop-opacity="0.25"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#ffb347" stop-opacity="0.8"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="handle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8774c"/><stop offset="0.4" stop-color="#6b4a2c"/><stop offset="1" stop-color="#3e2a19"/></linearGradient>` +
    `<radialGradient id="lanternHalo"><stop offset="0" stop-color="#ffc77a" stop-opacity="0.3"/><stop offset="1" stop-color="#ffc77a" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="lanternGlass"><stop offset="0" stop-color="#fff2c8"/><stop offset="0.6" stop-color="#ffc06a"/><stop offset="1" stop-color="#b8701f"/></radialGradient>` +
    `<radialGradient id="windowHalo"><stop offset="0" stop-color="#9fc2e8" stop-opacity="0.22"/><stop offset="1" stop-color="#9fc2e8" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="pane" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#e3eeff"/><stop offset="1" stop-color="#9fc2e8"/></linearGradient>` +
    `<linearGradient id="barrel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5236"/><stop offset="0.35" stop-color="#4a3222"/><stop offset="0.8" stop-color="#33261d"/><stop offset="1" stop-color="#4f5254"/></linearGradient>` +
    `<linearGradient id="cat" x1="0" y1="0" x2="1" y2="0.5"><stop offset="0" stop-color="#d08a50"/><stop offset="0.45" stop-color="#9a5a30"/><stop offset="1" stop-color="#4a2a18"/></linearGradient>` +
    `<radialGradient id="soot" cx="830" cy="520" r="420" gradientUnits="userSpaceOnUse" gradientTransform="translate(830 520) scale(0.85 1) translate(-830 -520)"><stop offset="0" stop-color="#050302" stop-opacity="0.92"/><stop offset="0.6" stop-color="#050302" stop-opacity="0.55"/><stop offset="1" stop-color="#050302" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="${WALL_W}" height="${WALL_H}" fill="#140f0b"/>` +
    `<rect width="${WALL_W}" height="500" fill="#2a221c"/>` +
    stoneWall(rand, 540, WALL_H) +
    `<rect y="496" width="${WALL_W}" height="48" fill="#3a281b"/>` +
    `<path d="M0 498 H${WALL_W}" stroke="#a8784e" stroke-width="2" opacity="0.35"/>` +
    `<path d="M0 512 H${WALL_W} M0 526 H${WALL_W}" stroke="#20150d" stroke-width="1.2" opacity="0.6"/>` +
    `<rect y="540" width="${WALL_W}" height="14" fill="#000" opacity="0.35"/>` +
    `<rect x="1780" y="0" width="34" height="${WALL_H}" fill="#33241a"/>` +
    `<rect x="210" y="0" width="34" height="${WALL_H}" fill="#33241a"/>` +
    `<rect width="${WALL_W}" height="${WALL_H}" fill="url(#soot)"/>` +
    barStock() +
    bellows() +
    forge(rand) +
    `<g transform="translate(14 0)">${cat()}</g>` +
    hammers() +
    `${horseshoe(1292, 800, -6)}${horseshoe(1346, 808, 5)}<g transform="translate(0 45)">${lantern(1322)}</g>` +
    `<g transform="translate(0 40)">${windowArt(rand)}</g>` +
    slate(rand) +
    barrel() +
    bladeRack() +
    texture(grain, WALL_W, WALL_H) +
    `<rect y="${WALL_H - 26}" width="${WALL_W}" height="26" fill="url(#skirt)"/>` +
    `<defs><linearGradient id="skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient></defs>` +
    `</svg>`
  )
}

/** The floor from above: worn stone flags with ash and scale, ashier toward the forge. */
export function floorSvg(grain: Grain | null): string {
  const rand = seededRandom(2718)
  let flags = ''
  const cols = 12
  const rows = 5
  const cw = FLOOR_W / cols
  const rh = FLOOR_H / rows
  const jitter: [number, number][][] = []
  for (let r = 0; r <= rows; r++) {
    jitter.push([])
    for (let c = 0; c <= cols; c++)
      jitter[r]!.push([
        c * cw + (c && c < cols ? (rand() - 0.5) * cw * 0.5 : 0) + (r % 2) * cw * 0.3,
        r * rh + (r && r < rows ? (rand() - 0.5) * rh * 0.45 : 0),
      ])
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [a, b, cc, d] = [
        jitter[r]![c]!,
        jitter[r]![c + 1]!,
        jitter[r + 1]![c + 1]!,
        jitter[r + 1]![c]!,
      ]
      flags +=
        `<path d="M${r1(a[0] + 4)} ${r1(a[1] + 4)} L${r1(b[0] - 4)} ${r1(b[1] + 4)} L${r1(cc[0] - 4)} ${r1(cc[1] - 4)} L${r1(d[0] + 4)} ${r1(d[1] - 4)} Z" fill="${pick(rand, ['#2b2520', '#2e2722', '#29231f', '#312924', '#2c2521', '#2a241f'])}" stroke="#211b17" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<path d="M${r1(a[0] + 6)} ${r1(a[1] + 6)} L${r1(b[0] - 6)} ${r1(b[1] + 6)}" stroke="#fff" stroke-opacity="0.035" stroke-width="2"/>`
    }
  let specks = ''
  for (let i = 0; i < 900; i++) {
    const x = Math.pow(rand(), 1.6) * FLOOR_W
    const y = rand() * FLOOR_H
    const ash = rand() < 0.5
    specks += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.8 + rand() * 2.2)}" fill="${ash ? '#7a7168' : '#0e0a08'}" opacity="${r1(0.15 + rand() * 0.35)}"/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FLOOR_W}" height="${FLOOR_H}" viewBox="0 0 ${FLOOR_W} ${FLOOR_H}">` +
    `<defs>` +
    `<linearGradient id="ashward" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e655c" stop-opacity="0.22"/><stop offset="0.45" stop-color="#6e655c" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="${FLOOR_W}" height="${FLOOR_H}" fill="#151110"/>` +
    flags +
    `<rect width="${FLOOR_W}" height="${FLOOR_H}" fill="url(#ashward)"/>` +
    specks +
    texture(grain, FLOOR_W, FLOOR_H) +
    `</svg>`
  )
}

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
