import { seededRandom } from '../engine/schema.ts'
import type { PotionSpec } from '../potion/compile.ts'
import { SLOT_MM } from '../potion/framing.ts'
import { potionOutline } from '../potion/outline.ts'
import { grain, type Grain } from '../smithy/grain.ts'

// The potion shop's room, front-on: a dark apothecary cabinet of jars and drawers behind a plank
// table, a candle low on the left. One seeded SVG on a board drawn at 1 unit per CSS pixel when
// the box stage is BOARD_SLOT px tall; the bottle's foot stands at FOOT.

export const BOARD_W = 2400
export const BOARD_H = 1400
/** The box stage's height, in board units, that the board is drawn to. */
export const BOARD_SLOT = 460
/** Where the bottle's foot stands. */
export const FOOT = { x: 1200, y: 900 }
/** The table's back edge against the cabinet, and the top of its front edge. */
export const TABLE = { back: 830, front: 1000, lip: 1024 }
/** The candle's foot on the table and its flame's middle, matching the stage's key light. */
export const CANDLE = { x: 820, y: 912, flameY: 754 }
/** The flame's foot, on the wick. */
export const FLAME_FOOT = { x: CANDLE.x, y: CANDLE.y - 138 }
/** The candle is drawn at this size about its foot. */
const CANDLE_SCALE = 0.85
/** Board units per millimetre at the bottle. */
export const UNITS_PER_MM = BOARD_SLOT / SLOT_MM

const r1 = (n: number) => Math.round(n * 10) / 10
const pick = <T>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)]!
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** How strongly the candle lights a point of the wall. */
const candleLight = (x: number, y: number) =>
  clamp01(1 - Math.hypot((x - CANDLE.x) / 1.25, y - CANDLE.flameY) / 900)

type Pt = [number, number]

// The shadow runs right and a little back across the table, away from the candle (front left).
const SHADOW_RUN = 1.3
const SHADOW_RISE = 0.11
/** The shadow's breadth across its run, foreshortened on the table, growing from the foot. */
const SHADOW_SPREAD = 0.12

export interface BottleOnTable {
  /** The cast shadow on the table, in mm: x across from the bottle's axis, y down from the foot. */
  shadow: string
  /** The foot's half width. */
  footMm: number
  widthMm: number
  /** Where the recipe card's string is tied, above the foot. */
  tie: { heightMm: number; halfWidthMm: number }
  /** The light through the liquid, pooled on the table inside the shadow. */
  glow: { xMm: number; yMm: number; rxMm: number }
}

/** The bottle's footing on the table, from its silhouette. */
export function bottleOnTable(spec: PotionSpec): BottleOnTable {
  const outline = potionOutline(spec)
  const right = outline.glass.slice(0, outline.glass.length / 2)
  const top = Math.max(...right.map(([, y]) => y))
  const upper = right.filter(([, y]) => y > spec.heightMm * 0.45 && y < top - 4)
  const narrowest = Math.min(...upper.map(([r]) => r))
  const neck = upper.filter(([r]) => r <= narrowest + 0.6).map(([, y]) => y)
  const tieAt = (Math.min(...neck) + Math.max(...neck)) / 2
  const cast = outline.glass.map(([x, y]): Pt => [
    x + y * SHADOW_RUN,
    -y * SHADOW_RISE + x * SHADOW_SPREAD * Math.min(1, y / 40),
  ])
  const liquidTop = outline.bands.length
    ? Math.max(...outline.bands.flatMap((b) => b.points.map(([, y]) => y)))
    : 30
  const pooled = liquidTop * 0.55
  return {
    shadow: `M${cast.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`,
    footMm: right[0]![0],
    widthMm: outline.widthMm,
    tie: { heightMm: tieAt, halfWidthMm: narrowest },
    glow: {
      xMm: pooled * SHADOW_RUN,
      yMm: -pooled * SHADOW_RISE,
      rxMm: Math.max(18, outline.widthMm * 0.5),
    },
  }
}

/** The grain tiles laid over a drawing in soft light; nothing without them. */
function texture(g: Grain | null): string {
  if (!g) return ''
  return (
    `<defs><pattern id="fine" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${g.fine}" width="128" height="128"/></pattern>` +
    `<pattern id="mottle" width="640" height="640" patternUnits="userSpaceOnUse"><image href="${g.mottle}" width="640" height="640"/></pattern></defs>` +
    `<g style="mix-blend-mode:soft-light"><rect width="${BOARD_W}" height="${BOARD_H}" fill="url(#mottle)"/><rect width="${BOARD_W}" height="${BOARD_H}" fill="url(#fine)"/></g>`
  )
}

const STILES = [470, 1000, 1590, 2070]
const STILE_W = 44
const BAYS: [number, number][] = [
  [0, STILES[0]!],
  [STILES[0]! + STILE_W, STILES[1]!],
  [STILES[1]! + STILE_W, STILES[2]!],
  [STILES[2]! + STILE_W, STILES[3]!],
  [STILES[3]! + STILE_W, BOARD_W],
]
const SHELVES = [300, 560]
const DRAWERS = { top: 600, rows: 4, rowH: 57 }

function backBoards(rand: () => number): string {
  let out = ''
  for (let x = 0; x < BOARD_W; x += 64) {
    out +=
      `<rect x="${x}" y="0" width="64" height="${TABLE.back}" fill="${pick(rand, ['#1c1215', '#1a1013', '#1f1417', '#181012'])}"/>` +
      `<path d="M${x + 0.5} 0 V${TABLE.back}" stroke="#0a0608" stroke-width="2.5" opacity="0.8"/>` +
      `<path d="M${x + 3} 0 V${TABLE.back}" stroke="#ffdcb8" stroke-width="1" opacity="${r1(0.025 + candleLight(x, 500) * 0.06)}"/>`
    for (let k = 0; k < 3; k++) {
      const gx = x + 10 + rand() * 44
      out += `<path d="M${r1(gx)} 0 C${r1(gx + 4)} 200 ${r1(gx - 3)} 420 ${r1(gx + 2)} ${TABLE.back}" stroke="#000" stroke-width="${r1(0.8 + rand())}" opacity="0.18" fill="none"/>`
    }
  }
  return out
}

function stile(x: number): string {
  const lit = candleLight(x + STILE_W / 2, 600)
  const towardCandle = x + STILE_W / 2 < CANDLE.x ? STILE_W - 3 : 1
  return (
    `<rect x="${x}" y="0" width="${STILE_W}" height="${TABLE.back}" fill="url(#stile)"/>` +
    `<rect x="${x + towardCandle}" y="0" width="2.5" height="${TABLE.back}" fill="#ffc790" opacity="${r1(0.08 + lit * 0.45)}"/>` +
    `<rect x="${x - 10}" y="0" width="10" height="${TABLE.back}" fill="url(#stileShade)" opacity="0.7"/>` +
    `<rect x="${x + STILE_W}" y="0" width="12" height="${TABLE.back}" fill="url(#stileShadeR)" opacity="0.8"/>`
  )
}

function shelfBoard(y: number): string {
  return (
    `<rect x="0" y="${y + 24}" width="${BOARD_W}" height="40" fill="url(#underShelf)"/>` +
    `<rect x="0" y="${y}" width="${BOARD_W}" height="10" fill="#3b2720"/>` +
    `<rect x="0" y="${y + 10}" width="${BOARD_W}" height="16" fill="url(#shelfFace)"/>` +
    `<path d="M0 ${y + 10.5} H${BOARD_W}" stroke="#ffcf98" stroke-width="1.4" opacity="0.28"/>` +
    `<rect x="0" y="${y + 10}" width="${BOARD_W}" height="16" fill="url(#candleSide)" style="mix-blend-mode:screen"/>`
  )
}

const LIQUIDS = [
  '#3e6a3a',
  '#5a3a72',
  '#7a5426',
  '#2e5e5a',
  '#6a2a40',
  '#45466c',
  '#6e6a2e',
  '#7a3524',
]

/** A jar or bottle standing on a shelf at (x, base): dark glass, a tint of liquid, light from the candle and a cool rim. */
function jar(rand: () => number, x: number, base: number, scale: number, glow?: string): string {
  const kind = Math.floor(rand() * 5)
  const w = (kind === 4 ? 18 + rand() * 8 : 34 + rand() * 30) * scale
  const h =
    (kind === 1 || kind === 3
      ? 92 + rand() * 44
      : kind === 4
        ? 40 + rand() * 18
        : 56 + rand() * 30) * scale
  const t = base - h
  let body: string
  let neckTop = t
  if (kind === 0) {
    const sh = h * 0.18
    body = `M${r1(x - w / 2)} ${base} V${r1(t + sh)} Q${r1(x - w / 2)} ${r1(t + sh * 0.3)} ${r1(x - w * 0.28)} ${r1(t + sh * 0.2)} V${r1(t)} H${r1(x + w * 0.28)} V${r1(t + sh * 0.2)} Q${r1(x + w / 2)} ${r1(t + sh * 0.3)} ${r1(x + w / 2)} ${r1(t + sh)} V${base} Z`
    neckTop = t
  } else if (kind === 1) {
    const r = w * 0.62
    const cy = base - r * 0.95
    body = `M${r1(x - w * 0.13)} ${r1(t)} V${r1(cy - r * 0.8)} C${r1(x - r * 1.2)} ${r1(cy - r * 0.5)} ${r1(x - r * 1.05)} ${base} ${r1(x)} ${base} C${r1(x + r * 1.05)} ${base} ${r1(x + r * 1.2)} ${r1(cy - r * 0.5)} ${r1(x + w * 0.13)} ${r1(cy - r * 0.8)} V${r1(t)} Z`
  } else if (kind === 2) {
    body = `M${r1(x - w / 2)} ${base} Q${r1(x - w * 0.62)} ${r1(t + h * 0.35)} ${r1(x - w * 0.36)} ${r1(t + h * 0.12)} V${r1(t)} H${r1(x + w * 0.36)} V${r1(t + h * 0.12)} Q${r1(x + w * 0.62)} ${r1(t + h * 0.35)} ${r1(x + w / 2)} ${base} Z`
  } else if (kind === 3) {
    body = `M${r1(x - w / 2)} ${base} V${r1(t + h * 0.45)} Q${r1(x - w / 2)} ${r1(t + h * 0.3)} ${r1(x - w * 0.16)} ${r1(t + h * 0.22)} V${r1(t)} H${r1(x + w * 0.16)} V${r1(t + h * 0.22)} Q${r1(x + w / 2)} ${r1(t + h * 0.3)} ${r1(x + w / 2)} ${r1(t + h * 0.45)} V${base} Z`
  } else {
    body = `M${r1(x - w / 2)} ${base} V${r1(t)} H${r1(x + w / 2)} V${base} Z`
  }
  const tint = glow ?? pick(rand, LIQUIDS)
  const level = base - h * (0.25 + rand() * 0.45)
  const lit = candleLight(x, base - h / 2)
  const facing = x < CANDLE.x ? 1 : -1
  const hiX = x - facing * w * 0.3
  const moon = clamp01((x - 1250) / 900)
  const id = `j${Math.floor(rand() * 1e9)}`
  let cap = ''
  if (kind === 0)
    cap =
      `<rect x="${r1(x - w * 0.34)}" y="${r1(t - 7 * scale)}" width="${r1(w * 0.68)}" height="${r1(8 * scale)}" rx="3" fill="#2a1d1e"/>` +
      `<ellipse cx="${x}" cy="${r1(t - 9 * scale)}" rx="${r1(w * 0.12)}" ry="${r1(5 * scale)}" fill="#3a2c30"/>`
  else if (kind === 4)
    cap = `<rect x="${r1(x - w * 0.34)}" y="${r1(t - 8 * scale)}" width="${r1(w * 0.68)}" height="${r1(9 * scale)}" rx="2" fill="#7a5a3a"/>`
  else {
    const cw = kind === 2 ? w * 0.66 : w * 0.3
    const wax = kind === 3 && rand() < 0.6
    cap =
      `<rect x="${r1(x - cw / 2)}" y="${r1(neckTop - 12 * scale)}" width="${r1(cw)}" height="${r1(14 * scale)}" rx="2.5" fill="${wax ? pick(rand, ['#5a1e24', '#2a3a26', '#3a2448']) : '#7d5c3c'}"/>` +
      `<path d="M${r1(x - cw / 2 + 2)} ${r1(neckTop - 11 * scale)} h${r1(cw - 4)}" stroke="#ffd8a8" stroke-width="1.2" opacity="${r1(0.15 + lit * 0.4)}"/>`
  }
  const label =
    rand() < 0.55 && kind !== 4
      ? `<rect x="${r1(x - w * 0.32)}" y="${r1(base - h * 0.52)}" width="${r1(w * 0.64)}" height="${r1(h * 0.2)}" rx="1.5" fill="#b8a684" opacity="${r1(0.32 + lit * 0.35)}"/>` +
        `<path d="M${r1(x - w * 0.22)} ${r1(base - h * 0.45)} h${r1(w * 0.44)} M${r1(x - w * 0.18)} ${r1(base - h * 0.39)} h${r1(w * 0.3)}" stroke="#2a1a14" stroke-width="1.3" opacity="${r1(0.25 + lit * 0.25)}"/>`
      : ''
  return (
    (glow
      ? `<ellipse cx="${x}" cy="${r1(base - h * 0.35)}" rx="${r1(w * 1.6)}" ry="${r1(h * 0.9)}" fill="${glow}" opacity="0.16" filter="url(#glowBlur)"/>`
      : '') +
    `<ellipse cx="${r1(x + 4)}" cy="${base - 1}" rx="${r1(w * 0.55)}" ry="3" fill="#000" opacity="0.45"/>` +
    `<clipPath id="${id}"><path d="${body}"/></clipPath>` +
    `<path d="${body}" fill="#140c10" opacity="0.93"/>` +
    `<g clip-path="url(#${id})">` +
    `<rect x="${r1(x - w)}" y="${r1(level)}" width="${r1(w * 2)}" height="${r1(h)}" fill="${tint}" opacity="${glow ? 0.9 : r1(0.45 + lit * 0.3)}"/>` +
    `<rect x="${r1(x - w)}" y="${r1(level)}" width="${r1(w * 2)}" height="${r1(h)}" fill="url(#jarShade)"/>` +
    `<rect x="${r1(x - w)}" y="${r1(level - 1)}" width="${r1(w * 2)}" height="2" fill="#fff" opacity="${glow ? 0.4 : 0.12}"/>` +
    `<path d="M${r1(hiX)} ${r1(t + h * 0.2)} V${r1(base - h * 0.12)}" stroke="#ffe2bd" stroke-width="${r1(2.6 * scale)}" stroke-linecap="round" opacity="${r1(0.08 + lit * 0.55)}"/>` +
    (moon > 0
      ? `<path d="M${r1(x + w * 0.42)} ${r1(t + h * 0.15)} V${r1(base - h * 0.2)}" stroke="#a9c0f0" stroke-width="${r1(1.8 * scale)}" opacity="${r1(moon * 0.45)}"/>`
      : '') +
    `</g>` +
    `<path d="${body}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.4"/>` +
    label +
    cap
  )
}

function book(rand: () => number, x: number, base: number, lean = 0): { svg: string; w: number } {
  const w = 11 + rand() * 9
  const h = 50 + rand() * 34
  const fill = pick(rand, ['#4a2236', '#2a4430', '#5e4220', '#25304a', '#3e2a22', '#5a2a24'])
  const lit = candleLight(x, base - h / 2)
  const svg =
    `<g transform="rotate(${lean} ${r1(x)} ${base})">` +
    `<rect x="${r1(x)}" y="${r1(base - h)}" width="${r1(w)}" height="${r1(h)}" rx="1.5" fill="${fill}"/>` +
    `<rect x="${r1(x)}" y="${r1(base - h)}" width="${r1(w)}" height="${r1(h)}" fill="url(#spine)"/>` +
    `<path d="M${r1(x + 2)} ${r1(base - h + 10)} h${r1(w - 4)} M${r1(x + 2)} ${r1(base - h + 14)} h${r1(w - 4)} M${r1(x + 2)} ${r1(base - 12)} h${r1(w - 4)}" stroke="#d9b45a" stroke-width="1.2" opacity="${r1(0.25 + lit * 0.4)}"/>` +
    `<rect x="${r1(x + w * 0.25)}" y="${r1(base - h * 0.62)}" width="${r1(w * 0.5)}" height="${r1(h * 0.16)}" fill="#c8b48a" opacity="${r1(0.15 + lit * 0.3)}"/>` +
    `</g>`
  return { svg, w }
}

function scrolls(x: number, base: number): string {
  let out = ''
  for (const [dx, dy, len] of [
    [0, 0, 120],
    [18, -16, 104],
    [8, -32, 112],
  ] as const) {
    const y = base - 9 + dy
    out +=
      `<rect x="${x + dx}" y="${y - 8}" width="${len}" height="17" rx="8" fill="#8c7a5c"/>` +
      `<rect x="${x + dx}" y="${y - 8}" width="${len}" height="17" rx="8" fill="url(#scroll)"/>` +
      `<ellipse cx="${x + dx + len}" cy="${y + 0.5}" rx="5" ry="8.5" fill="#6e5e44"/>` +
      `<ellipse cx="${x + dx + len}" cy="${y + 0.5}" rx="2.4" ry="4.5" fill="#3a2e22"/>`
  }
  return out + `<path d="M${x + 50} ${base - 42} v40" stroke="#6a2a2a" stroke-width="3"/>`
}

function herbs(rand: () => number, x: number, top: number, colour: string, flower: string): string {
  let stems = ''
  for (let i = 0; i < 9; i++) {
    const a = (rand() - 0.5) * 0.7
    const len = 70 + rand() * 50
    const ex = x + Math.sin(a) * len
    const ey = top + 12 + Math.cos(a) * len
    stems += `<path d="M${x} ${top + 14} Q${r1(x + Math.sin(a) * len * 0.4)} ${r1(top + 14 + len * 0.5)} ${r1(ex)} ${r1(ey)}" stroke="${colour}" stroke-width="2.2" fill="none" opacity="0.9"/>`
    for (let k = 0; k < 4; k++) {
      const f = 0.55 + k * 0.13
      stems += `<ellipse cx="${r1(x + (ex - x) * f + (rand() - 0.5) * 6)}" cy="${r1(top + 14 + (ey - top - 14) * f)}" rx="3.2" ry="5" fill="${flower}" opacity="${r1(0.55 + rand() * 0.3)}"/>`
    }
  }
  return (
    `<path d="M${x} ${top - 26} V${top + 8}" stroke="#7a6a4c" stroke-width="1.6"/>` +
    stems +
    `<rect x="${x - 7}" y="${top + 6}" width="14" height="12" rx="3" fill="#8a6e48"/>` +
    `<path d="M${x - 7} ${top + 10} h14 M${x - 7} ${top + 14} h14" stroke="#4a3a24" stroke-width="1.2"/>`
  )
}

function cobweb(x: number, y: number): string {
  let d = ''
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    d += `M${x} ${y} L${r1(x + Math.cos(a) * 110)} ${r1(y + Math.sin(a) * 110)} `
  }
  for (const r of [26, 50, 76, 100]) {
    let ring = `M${x + r} ${y}`
    for (let i = 1; i <= 5; i++) {
      const a = (i / 5) * (Math.PI / 2)
      const am = ((i - 0.5) / 5) * (Math.PI / 2)
      ring += ` Q${r1(x + Math.cos(am) * r * 0.86)} ${r1(y + Math.sin(am) * r * 0.86)} ${r1(x + Math.cos(a) * r)} ${r1(y + Math.sin(a) * r)}`
    }
    d += ring + ' '
  }
  return `<path d="${d}" stroke="#d8d0c4" stroke-width="0.8" fill="none" opacity="0.13"/>`
}

/** Everything on the two shelves, bay by bay, seeded so the room is the same on every visit. */
function shelfContents(rand: () => number): string {
  let out = ''
  const glows = new Map<string, string>([
    ['1:1', '#8fd66a'],
    ['2:1', '#b48ae6'],
    ['3:0', '#8fd66a'],
  ])
  SHELVES.forEach((shelfY, row) => {
    BAYS.forEach(([x0, x1], bay) => {
      let x = x0 + 22 + rand() * 20
      let placed = 0
      while (x < x1 - 30) {
        const roll = rand()
        if (roll < 0.17 && x < x1 - 140) {
          let bx = x
          const count = 3 + Math.floor(rand() * 4)
          for (let i = 0; i < count; i++) {
            const b = book(rand, bx, shelfY, i === count - 1 ? -9 : 0)
            out += b.svg
            bx += b.w + 1
          }
          x = bx + 20 + rand() * 20
        } else if (roll < 0.23 && x < x1 - 170) {
          out += scrolls(x, shelfY)
          x += 160
        } else {
          const scale = 0.62 + rand() * 0.3
          const key = `${bay}:${row}`
          const glow = placed === 1 && glows.has(key) ? glows.get(key) : undefined
          out += jar(rand, x + 24 * scale, shelfY, scale, glow)
          x += (48 + rand() * 34) * scale
          placed++
        }
      }
    })
  })
  return out
}

/** The bay behind the bottle, closed by plain doors so the clear glass has a quiet ground. */
const DOOR_BAY = 2

function drawer(rand: () => number, x: number, y: number, w: number, h: number): string {
  const lit = candleLight(x + w / 2, y + h / 2)
  const cx = x + w / 2
  return (
    `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="2" fill="${pick(rand, ['#26171a', '#2a1a1b', '#231517', '#28181a'])}"/>` +
    `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="2" fill="url(#drawerFace)"/>` +
    `<path d="M${r1(x + 2)} ${r1(y + 1.2)} H${r1(x + w - 2)}" stroke="#ffd4a4" stroke-width="1" opacity="${r1(0.04 + lit * 0.26)}"/>` +
    `<path d="M${r1(x + 2)} ${r1(y + h - 0.8)} H${r1(x + w - 2)}" stroke="#000" stroke-width="1.6" opacity="0.5"/>` +
    `<rect x="${r1(cx - 15)}" y="${r1(y + 9)}" width="30" height="12" rx="1" fill="#2e2016"/>` +
    `<rect x="${r1(cx - 13)}" y="${r1(y + 10.5)}" width="26" height="9" fill="#b5a07a" opacity="${r1(0.12 + lit * 0.4)}"/>` +
    `<path d="M${r1(cx - 9 + rand() * 3)} ${r1(y + 15)} h${r1(10 + rand() * 7)}" stroke="#2a1a12" stroke-width="1.2" opacity="${r1(0.2 + lit * 0.4)}"/>` +
    `<circle cx="${r1(cx)}" cy="${r1(y + h * 0.66)}" r="5" fill="none" stroke="#5e4428" stroke-width="2"/>` +
    `<path d="M${r1(cx - 4)} ${r1(y + h * 0.66 - 2)} A5 5 0 0 1 ${r1(cx + 2)} ${r1(y + h * 0.66 - 5)}" stroke="#ffd58a" stroke-width="1" fill="none" opacity="${r1(0.1 + lit * 0.55)}"/>`
  )
}

function door(x: number, y: number, w: number, h: number, hingeLeft: boolean): string {
  const lit = candleLight(x + w / 2, y + h / 2)
  const knobX = hingeLeft ? x + w - 16 : x + 16
  return (
    `<rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="${h}" rx="2" fill="#221416"/>` +
    `<rect x="${r1(x + 16)}" y="${y + 16}" width="${r1(w - 32)}" height="${h - 32}" rx="3" fill="#1b1012"/>` +
    `<path d="M${r1(x + 16)} ${y + h - 16} V${y + 16} H${r1(x + w - 16)}" stroke="#000" stroke-width="2.4" fill="none" opacity="0.55"/>` +
    `<path d="M${r1(x + w - 16)} ${y + 16} V${y + h - 16} H${r1(x + 16)}" stroke="#ffcf98" stroke-width="1.2" fill="none" opacity="${r1(0.04 + lit * 0.18)}"/>` +
    `<path d="M${r1(x + 2)} ${y + 1.5} H${r1(x + w - 2)}" stroke="#ffd4a4" stroke-width="1" opacity="${r1(0.04 + lit * 0.2)}"/>` +
    `<circle cx="${r1(knobX)}" cy="${y + h / 2}" r="4.5" fill="#6e5230"/>` +
    `<circle cx="${r1(knobX - 1.2)}" cy="${y + h / 2 - 1.4}" r="1.5" fill="#ffd58a" opacity="${r1(0.2 + lit * 0.5)}"/>`
  )
}

function lowerCabinet(rand: () => number): string {
  let out = `<rect x="0" y="${DRAWERS.top - 4}" width="${BOARD_W}" height="${TABLE.back - DRAWERS.top + 4}" fill="#140c0e"/>`
  BAYS.forEach(([x0, x1], bay) => {
    if (bay === DOOR_BAY) {
      const w = (x1 - x0 - 12) / 2
      out += door(x0 + 4, DRAWERS.top + 4, w, TABLE.back - DRAWERS.top - 8, true)
      out += door(x0 + 8 + w, DRAWERS.top + 4, w, TABLE.back - DRAWERS.top - 8, false)
      return
    }
    const cols = Math.max(1, Math.round((x1 - x0) / 96))
    const cw = (x1 - x0) / cols
    for (let r = 0; r < DRAWERS.rows; r++)
      for (let c = 0; c < cols; c++)
        out += drawer(
          rand,
          x0 + c * cw + 3,
          DRAWERS.top + r * DRAWERS.rowH + 3,
          cw - 6,
          DRAWERS.rowH - 6,
        )
  })
  return out
}

function plankGrain(rand: () => number, y0: number, y1: number): string {
  let out = ''
  const h = y1 - y0
  for (let i = 0; i < 22; i++) {
    const y = y0 + 2 + rand() * (h - 4)
    const amp = 0.6 + rand() * 1.6
    const phase = rand() * 900
    const x0 = -40 + rand() * 600
    const x1 = Math.min(BOARD_W + 40, x0 + 500 + rand() * 1800)
    let d = `M${r1(x0)} ${r1(y)}`
    for (let x = x0 + 80; x <= x1; x += 80)
      d += ` L${r1(x)} ${r1(y + Math.sin((x + phase) / 140) * amp)}`
    const light = rand() < 0.4
    out += `<path d="${d}" stroke="${light ? '#8a5e40' : '#0e0806'}" stroke-width="${r1(0.6 + rand() * 1.1)}" fill="none" opacity="${r1(light ? 0.18 + rand() * 0.15 : 0.25 + rand() * 0.25)}"/>`
  }
  if (rand() < 0.7) {
    const kx = 300 + rand() * 1800
    const ky = y0 + h * (0.3 + rand() * 0.4)
    out +=
      `<ellipse cx="${r1(kx)}" cy="${r1(ky)}" rx="${r1(10 + rand() * 8)}" ry="${r1(h * 0.16)}" fill="#120a07" opacity="0.65"/>` +
      `<ellipse cx="${r1(kx)}" cy="${r1(ky)}" rx="${r1(26 + rand() * 12)}" ry="${r1(h * 0.3)}" fill="none" stroke="#120a07" stroke-width="1" opacity="0.35"/>`
  }
  return out
}

function table(rand: () => number): string {
  const seams = [TABLE.back, 852, 880, 914, 954, TABLE.front]
  let planks = ''
  for (let i = 0; i < seams.length - 1; i++) {
    const y0 = seams[i]!
    const y1 = seams[i + 1]!
    planks +=
      `<rect x="0" y="${y0}" width="${BOARD_W}" height="${y1 - y0}" fill="${['#2a1a14', '#2f1d16', '#2c1b15', '#331f17', '#30201a'][i]}"/>` +
      plankGrain(rand, y0, y1) +
      Array.from({ length: 3 }, () => {
        const jx = r1(rand() * BOARD_W)
        return `<path d="M${jx} ${y0 + 1} L${r1(jx + (rand() - 0.5) * 4)} ${y1 - 1}" stroke="#080403" stroke-width="1.6" opacity="0.7"/><path d="M${r1(jx + 2)} ${y0 + 1} V${y1 - 1}" stroke="#a07050" stroke-width="0.7" opacity="0.18"/>`
      }).join('') +
      `<path d="M0 ${y1 - 0.5} H${BOARD_W}" stroke="#080403" stroke-width="${r1(1.2 + i * 0.5)}" opacity="0.85"/>` +
      `<path d="M0 ${y1 + 1} H${BOARD_W}" stroke="#a07050" stroke-width="0.8" opacity="0.22"/>`
  }
  let stains = ''
  for (const [x, y, rx] of [
    [1490, 868, 34],
    [1590, 944, 46],
    [1020, 886, 28],
    [700, 972, 40],
  ] as const)
    stains += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${r1(rx * 0.16)}" fill="none" stroke="#0b0604" stroke-width="2.4" opacity="0.32"/>`
  let drips = ''
  for (let i = 0; i < 7; i++) {
    const x = CANDLE.x - 90 + rand() * 190
    const y = CANDLE.y - 6 + rand() * 40
    drips += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(3 + rand() * 6)}" ry="${r1(1.4 + rand() * 1.6)}" fill="#d9c7a2" opacity="0.7"/>`
  }
  return (
    planks +
    stains +
    `<ellipse cx="1260" cy="958" rx="34" ry="5" fill="#0a0503" opacity="0.4"/>` +
    drips +
    `<rect x="0" y="${TABLE.back}" width="${BOARD_W}" height="${TABLE.front - TABLE.back}" fill="url(#tableLight)" style="mix-blend-mode:screen"/>` +
    `<rect x="0" y="${TABLE.back}" width="${BOARD_W}" height="${TABLE.front - TABLE.back}" fill="url(#tableMoon)" style="mix-blend-mode:screen"/>` +
    `<rect x="0" y="${TABLE.back}" width="${BOARD_W}" height="${TABLE.front - TABLE.back}" fill="url(#tableDark)"/>` +
    `<rect x="0" y="${TABLE.back}" width="${BOARD_W}" height="18" fill="url(#backEdge)"/>` +
    `<rect x="0" y="${TABLE.front}" width="${BOARD_W}" height="${TABLE.lip - TABLE.front}" fill="url(#lip)"/>` +
    `<path d="M0 ${TABLE.front + 1} H${BOARD_W}" stroke="url(#lipLine)" stroke-width="2.2"/>` +
    `<rect x="0" y="${TABLE.lip}" width="${BOARD_W}" height="${BOARD_H - TABLE.lip}" fill="url(#apron)"/>` +
    `<path d="M0 ${TABLE.lip} H${BOARD_W}" stroke="#000" stroke-width="3" opacity="0.7"/>` +
    Array.from(
      { length: 14 },
      (_, i) =>
        `<path d="M${90 + i * 172} ${TABLE.lip + 4} V${BOARD_H}" stroke="#000" stroke-width="2.5" opacity="0.4"/>` +
        `<path d="M${92.5 + i * 172} ${TABLE.lip + 4} V${BOARD_H}" stroke="#8a5a3e" stroke-width="1" opacity="0.08"/>`,
    ).join('')
  )
}

function candle(flame: boolean): string {
  const { x, y } = CANDLE
  const top = y - 150
  const w = 40
  return (
    `<g transform="translate(${x} ${y}) scale(${CANDLE_SCALE}) translate(${-x} ${-y})">` +
    `<ellipse cx="${x + 30}" cy="${y + 4}" rx="96" ry="10" fill="#000" opacity="0.4" filter="url(#soft6)"/>` +
    `<ellipse cx="${x}" cy="${y + 2}" rx="64" ry="11" fill="#000" opacity="0.55"/>` +
    `<path d="M${x - 62} ${y - 8} Q${x - 60} ${y + 9} ${x} ${y + 10} Q${x + 60} ${y + 9} ${x + 62} ${y - 8} Z" fill="url(#dish)"/>` +
    `<ellipse cx="${x}" cy="${y - 8}" rx="62" ry="10" fill="#b8843e"/>` +
    `<ellipse cx="${x}" cy="${y - 8}" rx="54" ry="7.5" fill="#6a4622"/>` +
    `<path d="M${x - 56} ${y - 10} Q${x - 20} ${y - 18} ${x + 12} ${y - 17}" stroke="#ffe0a0" stroke-width="2" fill="none" opacity="0.7"/>` +
    `<path d="M${x + 58} ${y - 2} q14 -2 22 -20 q4 -10 -4 -8 q-6 2 -10 14" fill="#7a5226" stroke="#c99450" stroke-width="1.4"/>` +
    `<ellipse cx="${x + 4}" cy="${y - 12}" rx="30" ry="6" fill="#e2d1ab" opacity="0.9"/>` +
    `<path d="M${x - w / 2} ${y - 12} V${top + 8} Q${x - w / 2 + 2} ${top - 1} ${x - 8} ${top + 1} Q${x - 2} ${top + 6} ${x + 4} ${top + 2} Q${x + w / 2 - 2} ${top - 3} ${x + w / 2} ${top + 6} V${y - 12} Z" fill="url(#wax)"/>` +
    `<path d="M${x - w / 2} ${top + 6} q-3 30 1 52 q3 8 4 -4 q-1 -24 2 -40 Z" fill="#f8ead0" opacity="0.92"/>` +
    `<path d="M${x + 6} ${top + 3} q1 18 -1 30 q2 8 4 -2 q0 -14 1 -26 Z" fill="#efdcb6"/>` +
    `<path d="M${x + w / 2} ${top + 10} q4 36 -1 70 q-3 8 -4 -2 q-1 -34 2 -66 Z" fill="#a89070" opacity="0.8"/>` +
    `<ellipse cx="${x - 1}" cy="${top + 4}" rx="${w / 2 - 6}" ry="4.5" fill="url(#waxPool)"/>` +
    `<path d="M${x} ${top + 4} q-1 -7 2 -14" stroke="#1a100a" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `</g>` +
    (flame ? flameSvg() : '')
  )
}

/** The flame's body and its blue root and white core, around its foot at the origin. */
export const FLAME = {
  halo: { cy: -18, rx: 20, ry: 34 },
  body: 'M0 -48 C10 -30 11 -10 0 0 C-11 -10 -10 -30 0 -48 Z',
  root: { cy: -9, rx: 3.4, ry: 7 },
  core: { cy: -20, rx: 3.4, ry: 9 },
}

function flameSvg(): string {
  const { halo, root, core } = FLAME
  return (
    `<g transform="translate(${FLAME_FOOT.x} ${FLAME_FOOT.y})">` +
    `<ellipse cy="${halo.cy}" rx="${halo.rx}" ry="${halo.ry}" fill="url(#flameHalo)"/>` +
    `<path d="${FLAME.body}" fill="url(#flame)"/>` +
    `<ellipse cy="${root.cy}" rx="${root.rx}" ry="${root.ry}" fill="#4a72d8" opacity="0.55"/>` +
    `<ellipse cy="${core.cy}" rx="${core.rx}" ry="${core.ry}" fill="#fffef2" opacity="0.9"/></g>`
  )
}

const FLAME_DEFS =
  `<radialGradient id="flame" cx="0.5" cy="0.72" r="0.62"><stop offset="0" stop-color="#fffbe6"/><stop offset="0.32" stop-color="#ffe089"/><stop offset="0.75" stop-color="#ff9a3a"/><stop offset="1" stop-color="#ff7420" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="flameHalo"><stop offset="0" stop-color="#ffd58c" stop-opacity="0.5"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>`

function mortar(): string {
  const x = 1530
  const y = 884
  return (
    `<g transform="translate(${x} ${y}) scale(0.8) translate(${-x} ${-y})">` +
    `<ellipse cx="${x + 26}" cy="${y + 2}" rx="78" ry="9" fill="#000" opacity="0.5" filter="url(#soft6)"/>` +
    `<path d="M${x - 56} ${y - 46} Q${x - 58} ${y + 2} ${x} ${y + 4} Q${x + 58} ${y + 2} ${x + 56} ${y - 46} Z" fill="url(#stone)"/>` +
    `<ellipse cx="${x}" cy="${y - 46}" rx="56" ry="9" fill="#2a2422"/>` +
    `<ellipse cx="${x}" cy="${y - 46}" rx="56" ry="9" fill="none" stroke="#7a6e64" stroke-width="2" opacity="0.7"/>` +
    `<ellipse cx="${x}" cy="${y - 44}" rx="44" ry="6" fill="#16110f"/>` +
    `<path d="M${x - 52} ${y - 38} Q${x - 52} ${y - 10} ${x - 22} ${y}" stroke="#c4a888" stroke-width="2.4" fill="none" opacity="0.35"/>` +
    `<path d="M${x + 6} ${y - 48} L${x + 52} ${y - 118}" stroke="#5e4028" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M${x + 2} ${y - 50} L${x + 46} ${y - 118}" stroke="#c09060" stroke-width="3" stroke-linecap="round" opacity="0.45"/>` +
    `<path d="M${x + 56} ${y - 116} L${x + 56} ${y - 98}" stroke="#a9c0f0" stroke-width="1.5" opacity="0.25"/>` +
    `</g>`
  )
}

function tableBits(rand: () => number): string {
  let petals = ''
  for (let i = 0; i < 9; i++) {
    const x = 1330 + rand() * 170
    const y = 932 + rand() * 50
    const s = 4.5 + rand() * 3
    petals += `<path transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rand() * 72)}) scale(1 0.42)" d="M0 ${-s} L${r1(s * 0.3)} ${r1(-s * 0.3)} L${s} 0 L${r1(s * 0.3)} ${r1(s * 0.3)} L0 ${s} L${r1(-s * 0.3)} ${r1(s * 0.3)} L${-s} 0 L${r1(-s * 0.3)} ${r1(-s * 0.3)} Z" fill="#e8b84a" opacity="${r1(0.55 + rand() * 0.3)}"/>`
  }
  const cork =
    `<g transform="translate(1012 962) rotate(-14)">` +
    `<ellipse cx="4" cy="9" rx="20" ry="4" fill="#000" opacity="0.5"/>` +
    `<path d="M-16 -7 L14 -9 L16 7 L-14 8 Z" fill="#9a7448"/>` +
    `<ellipse cx="15" cy="-1" rx="3.5" ry="8" fill="#c49a64"/>` +
    `<path d="M-14 -5 L12 -7" stroke="#ffe0b0" stroke-width="1.4" opacity="0.5"/></g>`
  const spoon =
    `<g transform="translate(1380 980) rotate(-8)">` +
    `<ellipse cx="6" cy="6" rx="60" ry="5" fill="#000" opacity="0.45" filter="url(#soft6)"/>` +
    `<path d="M-50 0 L20 -3" stroke="#8a6a3a" stroke-width="5" stroke-linecap="round"/>` +
    `<ellipse cx="34" cy="-3" rx="18" ry="7" fill="#9a7840"/>` +
    `<ellipse cx="32" cy="-4" rx="11" ry="3.6" fill="#e8c27a" opacity="0.55"/>` +
    `<path d="M-50 -1.5 L18 -4.5" stroke="#ffd890" stroke-width="1.2" opacity="0.5"/></g>`
  const books =
    `<g transform="translate(1700 868)">` +
    `<ellipse cx="20" cy="4" rx="120" ry="10" fill="#000" opacity="0.5" filter="url(#soft6)"/>` +
    `<rect x="-90" y="-30" width="190" height="30" rx="3" fill="#3a1e2a"/><rect x="-90" y="-30" width="190" height="5" fill="#000" opacity="0.3"/>` +
    `<rect x="-84" y="-26" width="180" height="20" fill="#c9b48a" opacity="0.35"/>` +
    `<rect x="-76" y="-56" width="170" height="26" rx="3" fill="#22382a"/><rect x="-70" y="-52" width="160" height="16" fill="#c9b48a" opacity="0.3"/>` +
    `<path d="M-76 -55 H94" stroke="#a9c0f0" stroke-width="1.2" opacity="0.3"/></g>`
  return cork + spoon + petals + books
}

const DEFS =
  `<filter id="glowBlur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="16"/></filter>` +
  `<filter id="soft6" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>` +
  `<linearGradient id="stile" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1a16"/><stop offset="0.5" stop-color="#33211b"/><stop offset="1" stop-color="#1e1310"/></linearGradient>` +
  `<linearGradient id="stileShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient>` +
  `<linearGradient id="stileShadeR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="underShelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="shelfFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3024"/><stop offset="1" stop-color="#22140f"/></linearGradient>` +
  `<radialGradient id="candleSide" cx="${CANDLE.x}" cy="${CANDLE.flameY}" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff9a4a" stop-opacity="0.35"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="jarShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>` +
  `<linearGradient id="spine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.1"/><stop offset="0.3" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>` +
  `<linearGradient id="scroll" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>` +
  `<linearGradient id="drawerFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>` +
  `<radialGradient id="wallWarm" cx="${CANDLE.x}" cy="${CANDLE.flameY}" r="1000" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CANDLE.x} ${CANDLE.flameY}) scale(1.25 1) translate(${-CANDLE.x} ${-CANDLE.flameY})"><stop offset="0" stop-color="#ffa860" stop-opacity="0.34"/><stop offset="0.3" stop-color="#ff9450" stop-opacity="0.12"/><stop offset="1" stop-color="#ff9450" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="wallDark" cx="${CANDLE.x + 120}" cy="${CANDLE.flameY}" r="1100" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CANDLE.x + 120} ${CANDLE.flameY}) scale(1.15 1) translate(${-CANDLE.x - 120} ${-CANDLE.flameY})"><stop offset="0" stop-color="#07040a" stop-opacity="0"/><stop offset="0.22" stop-color="#07040a" stop-opacity="0.3"/><stop offset="0.5" stop-color="#07040a" stop-opacity="0.72"/><stop offset="0.8" stop-color="#07040a" stop-opacity="0.92"/><stop offset="1" stop-color="#07040a" stop-opacity="0.97"/></radialGradient>` +
  `<linearGradient id="wallTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07040a" stop-opacity="0.92"/><stop offset="0.35" stop-color="#07040a" stop-opacity="0.75"/><stop offset="0.65" stop-color="#07040a" stop-opacity="0.2"/><stop offset="1" stop-color="#07040a" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="wallMoon" x1="1" y1="0" x2="0.45" y2="0.7"><stop offset="0" stop-color="#9fb6ee" stop-opacity="0.16"/><stop offset="1" stop-color="#9fb6ee" stop-opacity="0"/></linearGradient>` +
  `<radialGradient id="tableLight" cx="${CANDLE.x + 140}" cy="${CANDLE.y}" r="760" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CANDLE.x + 140} ${CANDLE.y}) scale(1 0.3) translate(${-CANDLE.x - 140} ${-CANDLE.y})"><stop offset="0" stop-color="#ffb066" stop-opacity="0.5"/><stop offset="0.4" stop-color="#ff9a50" stop-opacity="0.24"/><stop offset="0.75" stop-color="#ff9a50" stop-opacity="0.06"/><stop offset="1" stop-color="#ff9a50" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="tableMoon" x1="1" y1="0" x2="0.5" y2="0.4"><stop offset="0" stop-color="#9fb6ee" stop-opacity="0.12"/><stop offset="1" stop-color="#9fb6ee" stop-opacity="0"/></linearGradient>` +
  `<radialGradient id="tableDark" cx="${CANDLE.x + 200}" cy="${CANDLE.y}" r="1250" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CANDLE.x + 200} ${CANDLE.y}) scale(1 0.35) translate(${-CANDLE.x - 200} ${-CANDLE.y})"><stop offset="0.3" stop-color="#050304" stop-opacity="0"/><stop offset="0.75" stop-color="#050304" stop-opacity="0.55"/><stop offset="1" stop-color="#050304" stop-opacity="0.85"/></radialGradient>` +
  `<linearGradient id="backEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="lip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a28"/><stop offset="0.35" stop-color="#3a2419"/><stop offset="1" stop-color="#120a08"/></linearGradient>` +
  `<radialGradient id="lipLine" cx="${CANDLE.x}" cy="${TABLE.front}" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffc888" stop-opacity="0.75"/><stop offset="0.6" stop-color="#c8865a" stop-opacity="0.25"/><stop offset="1" stop-color="#8a5a3e" stop-opacity="0.1"/></radialGradient>` +
  `<linearGradient id="apron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e120d"/><stop offset="0.2" stop-color="#110a08"/><stop offset="1" stop-color="#070405"/></linearGradient>` +
  `<linearGradient id="dish" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6b468"/><stop offset="0.55" stop-color="#9a6a32"/><stop offset="1" stop-color="#3e2810"/></linearGradient>` +
  `<linearGradient id="wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2d8"/><stop offset="0.45" stop-color="#ead8b2"/><stop offset="1" stop-color="#8a7456"/></linearGradient>` +
  `<radialGradient id="waxPool"><stop offset="0" stop-color="#fff4c8"/><stop offset="1" stop-color="#e8cf9a"/></radialGradient>` +
  `<linearGradient id="stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a5e56"/><stop offset="0.45" stop-color="#3e3632"/><stop offset="1" stop-color="#1c1816"/></linearGradient>` +
  FLAME_DEFS

/** The whole room: cabinet, shelves, drawers, table and candle; the flame only for the picture, since the scene's flickers. */
export function roomSvg(g: Grain | null, { flame }: { flame: boolean }): string {
  const rand = seededRandom(8128)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD_W}" height="${BOARD_H}" viewBox="0 0 ${BOARD_W} ${BOARD_H}">` +
    `<defs>${DEFS}</defs>` +
    `<rect width="${BOARD_W}" height="${BOARD_H}" fill="#110b0e"/>` +
    backBoards(rand) +
    shelfBoard(SHELVES[0]!) +
    shelfBoard(SHELVES[1]!) +
    shelfContents(rand) +
    lowerCabinet(rand) +
    STILES.map(stile).join('') +
    herbs(rand, 660, SHELVES[0]! + 26, '#5e6a3a', '#9a86c8') +
    herbs(rand, 728, SHELVES[0]! + 26, '#6a6a40', '#c8b46a') +
    herbs(rand, 1452, SHELVES[0]! + 26, '#5a6a42', '#a68ad0') +
    cobweb(STILES[1]! + STILE_W, SHELVES[0]! + 26) +
    `<rect width="${BOARD_W}" height="${TABLE.back}" fill="url(#wallWarm)" style="mix-blend-mode:screen"/>` +
    `<rect width="${BOARD_W}" height="${TABLE.back}" fill="url(#wallMoon)" style="mix-blend-mode:screen"/>` +
    `<rect width="${BOARD_W}" height="${TABLE.back}" fill="url(#wallDark)"/>` +
    `<rect width="${BOARD_W}" height="${TABLE.back}" fill="url(#wallTop)"/>` +
    table(rand) +
    mortar() +
    tableBits(rand) +
    candle(flame) +
    texture(g) +
    `</svg>`
  )
}

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

let image: string | null = null

/** The room, built on the potion shop's first visit rather than on every page's load. */
export function roomImage(): string {
  image ??= svgUrl(roomSvg(grain(), { flame: false }))
  return image
}
