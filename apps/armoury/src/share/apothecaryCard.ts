import { bottleOnTable, CANDLE, FOOT, roomSvg, UNITS_PER_MM } from '../apothecary/tableArt.ts'
import type { Params } from '../engine/schema.ts'
import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { isGold } from '../potion/describe.ts'
import { BASE_LINE, PICTURE_GROUND, SLOT_MM } from '../potion/framing.ts'
import { CARD_HEIGHT, CARD_WIDTH, type CardContent, type TagColours } from './shareCard.ts'

/** Where the bottle's foot stands on the card. */
const FOOT_AT = { x: 640, y: 800 }
/** Every bottle is drawn this tall, foot to stopper allowance, filling the frame above the card as in P2. */
const BOTTLE_PX = 0.44 * CARD_HEIGHT
/** A pixel this far from the ground, in its most different channel, is wholly the bottle's. */
const LIFT = 40

type Rgb = [number, number, number]
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb

/**
 * Turns a capture drawn over the ground (P2) into one with a clear background, in place: the
 * ground goes clear and faint light over it (the glass's reflections) keeps what it added. A
 * capture that already has a clear background is left as it is.
 */
export function liftFromGround(data: Uint8ClampedArray, ground: Rgb): void {
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(
      Math.abs(data[i]! - ground[0]),
      Math.abs(data[i + 1]! - ground[1]),
      Math.abs(data[i + 2]! - ground[2]),
    )
    const a = Math.min(1, d / LIFT)
    if (a < 1)
      for (let c = 0; c < 3; c++)
        data[i + c] = a === 0 ? ground[c]! : ground[c]! + (data[i + c]! - ground[c]!) / a
    data[i + 3] = Math.round(a * 255)
  }
}

const CREAM: TagColours = {
  paper: ['#ece3cc', '#dccfb1'],
  hole: '#1a1014',
  ring: '#c9b48e',
  number: '#5e4859',
  name: '#2a1a26',
  text: '#4a3446',
  rule: 'rgba(42,26,38,0.25)',
}

const GILT: TagColours = {
  paper: ['#f2e3b8', '#e2c98f'],
  hole: '#1a1014',
  ring: '#d9b45c',
  number: '#6b4813',
  name: '#3a2306',
  text: '#563810',
  rule: 'rgba(58,35,6,0.3)',
  edge: '#b8892c',
}

/** The recipe card's colours: cream, or gilt for a mixed secret blend. */
export const recipeTag = (params: Params): TagColours => (isGold(params) ? GILT : CREAM)

const preload = (svg: () => string) => {
  if (typeof Image === 'undefined') return null
  const image = new Image()
  image.src = `data:image/svg+xml,${encodeURIComponent(svg())}`
  return image
}
let art: { room: HTMLImageElement | null } | null = null

/** The picture's room, started loading when the potion shop is first shown, so it is ready to paint. */
export function apothecaryCardArt() {
  // No grain in the picture: it doubles the PNG's size and its encoding time.
  art ??= { room: preload(() => roomSvg(null, { flame: true })) }
  return art
}

export interface PictureFraming {
  pxPerMm: number
  foot: { x: number; y: number }
  /** A point of the room's drawing on the card. */
  toCard: (bx: number, by: number) => { x: number; y: number }
}

/** The picture's scale for this bottle: the room is drawn at the bottle's scale, about its foot. */
export function pictureFraming(spec: PotionSpec): PictureFraming {
  const pxPerMm = BOTTLE_PX / spec.heightMm
  const unit = pxPerMm / UNITS_PER_MM
  return {
    pxPerMm,
    foot: FOOT_AT,
    toCard: (bx, by) => ({
      x: FOOT_AT.x + (bx - FOOT.x) * unit,
      y: FOOT_AT.y + (by - FOOT.y) * unit,
    }),
  }
}

function drawRoom(ctx: CanvasRenderingContext2D, framing: PictureFraming) {
  const { room } = apothecaryCardArt()
  ctx.fillStyle = '#110b0e'
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  if (room && room.complete && room.naturalWidth > 0) {
    const f = room.naturalWidth / 2400
    const unit = framing.pxPerMm / UNITS_PER_MM
    const origin = { x: FOOT.x - FOOT_AT.x / unit, y: FOOT.y - FOOT_AT.y / unit }
    ctx.drawImage(
      room,
      origin.x * f,
      origin.y * f,
      (CARD_WIDTH / unit) * f,
      (CARD_HEIGHT / unit) * f,
      0,
      0,
      CARD_WIDTH,
      CARD_HEIGHT,
    )
  }
  const flame = framing.toCard(CANDLE.x, CANDLE.flameY)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const light = ctx.createRadialGradient(flame.x, flame.y, 0, flame.x, flame.y, 760)
  light.addColorStop(0, 'rgba(255,176,104,0.22)')
  light.addColorStop(0.3, 'rgba(255,150,80,0.07)')
  light.addColorStop(1, 'rgba(255,150,80,0)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()
}

/** Fills a path's soft shadow only: the path itself lands far off the canvas. */
function softFill(ctx: CanvasRenderingContext2D, path: Path2D, colour: string, blur: number) {
  const away = 10000
  ctx.save()
  ctx.shadowColor = colour
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = away
  ctx.translate(-away, 0)
  ctx.fillStyle = '#000'
  ctx.fill(path)
  ctx.restore()
}

function drawBottle(
  ctx: CanvasRenderingContext2D,
  c: CardContent,
  spec: PotionSpec,
  { pxPerMm }: PictureFraming,
) {
  const footing = bottleOnTable(spec)
  const mm = new DOMMatrix([pxPerMm, 0, 0, pxPerMm, FOOT_AT.x, FOOT_AT.y])
  const shadow = new Path2D()
  shadow.addPath(new Path2D(footing.shadow), mm)
  softFill(ctx, shadow, 'rgba(0,0,0,0.55)', 6 * pxPerMm)
  softFill(ctx, shadow, 'rgba(0,0,0,0.35)', 1.7 * pxPerMm)
  const contact = new Path2D()
  const rx = footing.footMm * pxPerMm * 1.05
  contact.ellipse(FOOT_AT.x + 1.3 * pxPerMm, FOOT_AT.y, rx, 2.6 * pxPerMm, 0, 0, Math.PI * 2)
  softFill(ctx, contact, 'rgba(0,0,0,0.85)', 2.6 * pxPerMm)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gx = FOOT_AT.x + footing.glow.xMm * pxPerMm
  const gy = FOOT_AT.y + footing.glow.yMm * pxPerMm
  const glowRx = footing.glow.rxMm * pxPerMm
  ctx.translate(gx, gy)
  ctx.scale(1, 0.16)
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRx)
  pool.addColorStop(0, `rgba(${c.glowRgb},0.42)`)
  pool.addColorStop(0.5, `rgba(${c.glowRgb},0.14)`)
  pool.addColorStop(1, `rgba(${c.glowRgb},0)`)
  ctx.fillStyle = pool
  ctx.fillRect(-glowRx, -glowRx, glowRx * 2, glowRx * 2)
  ctx.restore()

  const lifted = document.createElement('canvas')
  lifted.width = c.item.width
  lifted.height = c.item.height
  const lctx = lifted.getContext('2d')
  if (!lctx) return
  lctx.drawImage(c.item, 0, 0)
  const pixels = lctx.getImageData(0, 0, lifted.width, lifted.height)
  liftFromGround(pixels.data, rgbOf(PICTURE_GROUND))
  lctx.putImageData(pixels, 0, 0)
  const slot = pxPerMm * SLOT_MM
  const h = (slot * c.item.height) / c.item.width
  ctx.drawImage(lifted, FOOT_AT.x - slot / 2, FOOT_AT.y - BASE_LINE * h, slot, h)
}

function drawVignette(ctx: CanvasRenderingContext2D) {
  const v = ctx.createRadialGradient(FOOT_AT.x - 60, 560, 320, FOOT_AT.x - 60, 620, 900)
  v.addColorStop(0, 'rgba(7,4,10,0)')
  v.addColorStop(1, 'rgba(7,4,10,0.7)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const top = ctx.createLinearGradient(0, 0, 0, 220)
  top.addColorStop(0, 'rgba(7,4,10,0.85)')
  top.addColorStop(1, 'rgba(7,4,10,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, CARD_WIDTH, 220)
}

/** The potion's picture: the cabinet and table, the candle, the bottle on the table and its recipe card. */
export function paintApothecaryCard(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
): TagColours {
  const spec = compilePotion(content.params)
  const framing = pictureFraming(spec)
  drawRoom(ctx, framing)
  drawBottle(ctx, content, spec, framing)
  drawVignette(ctx)
  return recipeTag(content.params)
}
