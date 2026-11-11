import {
  ANVIL_H,
  ANVIL_TOP,
  ANVIL_W,
  anvilSvg,
  ART_HEIGHT,
  ART_WIDTH,
  ART_X,
  ART_Y,
} from '../smithy/anvilArt.ts'
import { COALS, floorSvg, WALL_H, wallSvg, WINDOW } from '../smithy/forgeArt.ts'
import { CARD_HEIGHT, CARD_WIDTH, type CardContent } from './shareCard.ts'

const WALL_BOTTOM = 540
/** The wall and floor art are drawn at this scale, centred on ART_CENTRE. */
const ART_SCALE = 0.9
const ART_CENTRE = 1160
/** The anvil button's width on the card, and the middle of its long axis. */
const BUTTON = 900
const BUTTON_MIDDLE = 690
const SLOT_SPREAD = 1.3

const preload = (svg: () => string) => {
  if (typeof Image === 'undefined') return null
  const image = new Image()
  image.src = `data:image/svg+xml,${encodeURIComponent(svg())}`
  return image
}
const images = { wall: preload(wallSvg), floor: preload(floorSvg), anvil: preload(anvilSvg) }
const ready = (image: HTMLImageElement | null): image is HTMLImageElement =>
  !!image && image.complete && image.naturalWidth > 0

const artX = (x: number) => (x - ART_CENTRE) * ART_SCALE + CARD_WIDTH / 2

function drawWall(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#140f0b'
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
  const sourceHeight = WALL_BOTTOM / ART_SCALE
  if (ready(images.wall)) {
    const sx = ART_CENTRE - CARD_WIDTH / 2 / ART_SCALE
    const fx = images.wall.naturalWidth / 2400
    const fy = images.wall.naturalHeight / WALL_H
    ctx.drawImage(
      images.wall,
      sx * fx,
      (WALL_H - sourceHeight) * fy,
      (CARD_WIDTH / ART_SCALE) * fx,
      sourceHeight * fy,
      0,
      0,
      CARD_WIDTH,
      WALL_BOTTOM,
    )
  }
  const coalY = WALL_BOTTOM - (WALL_H - COALS.y) * ART_SCALE
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const forge = ctx.createRadialGradient(artX(COALS.x), coalY, 0, artX(COALS.x), coalY, 600)
  forge.addColorStop(0, 'rgba(255,170,90,0.45)')
  forge.addColorStop(0.35, 'rgba(255,130,60,0.14)')
  forge.addColorStop(1, 'rgba(255,120,50,0)')
  ctx.fillStyle = forge
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()
  const shade = ctx.createLinearGradient(0, 0, 0, WALL_BOTTOM)
  shade.addColorStop(0, 'rgba(6,4,3,0.92)')
  shade.addColorStop(0.3, 'rgba(6,4,3,0.45)')
  shade.addColorStop(0.65, 'rgba(6,4,3,0.08)')
  shade.addColorStop(1, 'rgba(6,4,3,0.3)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
  const side = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0)
  side.addColorStop(0.75, 'rgba(6,4,3,0)')
  side.addColorStop(1, 'rgba(6,4,3,0.7)')
  ctx.fillStyle = side
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  const height = CARD_HEIGHT - WALL_BOTTOM
  ctx.fillStyle = '#151110'
  ctx.fillRect(0, WALL_BOTTOM, CARD_WIDTH, height)
  if (ready(images.floor)) {
    const f = images.floor.naturalWidth / 2400
    ctx.drawImage(
      images.floor,
      (ART_CENTRE - CARD_WIDTH / 2 / ART_SCALE) * f,
      0,
      (CARD_WIDTH / ART_SCALE) * f,
      (height / ART_SCALE) * f,
      0,
      WALL_BOTTOM,
      CARD_WIDTH,
      height,
    )
  }
  const contact = ctx.createLinearGradient(0, WALL_BOTTOM, 0, WALL_BOTTOM + 70)
  contact.addColorStop(0, 'rgba(0,0,0,0.75)')
  contact.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = contact
  ctx.fillRect(0, WALL_BOTTOM, CARD_WIDTH, 70)
  const vignette = ctx.createRadialGradient(540, 760, 200, 540, 760, 820)
  vignette.addColorStop(0, 'rgba(8,6,5,0)')
  vignette.addColorStop(1, 'rgba(8,6,5,0.85)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, WALL_BOTTOM, CARD_WIDTH, height)
}

function drawWindowLight(ctx: CanvasRenderingContext2D) {
  const x = artX(WINDOW.x)
  const y = WALL_BOTTOM - (WALL_H - WINDOW.y) * ART_SCALE
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.translate(x, y)
  ctx.rotate((36 * Math.PI) / 180)
  const width = 200
  const across = ctx.createLinearGradient(-width, 0, width, 0)
  across.addColorStop(0, 'rgba(190,215,255,0)')
  across.addColorStop(0.5, 'rgba(205,225,255,0.13)')
  across.addColorStop(1, 'rgba(190,215,255,0)')
  ctx.fillStyle = across
  ctx.fillRect(-width, 0, width * 2, 900)
  ctx.restore()
}

/** Draws only the capture's shadow: the image itself lands far off the canvas. */
function shadowOf(
  ctx: CanvasRenderingContext2D,
  c: CardContent,
  at: { x: number; y: number; w: number; h: number },
  colour: string,
  blur: number,
  dx: number,
  dy: number,
) {
  const away = 10000
  ctx.save()
  ctx.shadowColor = colour
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = away + dx
  ctx.shadowOffsetY = dy
  ctx.drawImage(c.item, at.x - away, at.y, at.w, at.h)
  ctx.restore()
}

function drawAnvil(ctx: CanvasRenderingContext2D, c: CardContent) {
  const unit = BUTTON / ANVIL_W
  const left = CARD_WIDTH / 2 - BUTTON / 2
  const top = BUTTON_MIDDLE - (ANVIL_H / 2) * unit
  if (ready(images.anvil)) {
    ctx.drawImage(
      images.anvil,
      left + ART_X * unit,
      top + ART_Y * unit,
      ART_WIDTH * unit,
      ART_HEIGHT * unit,
    )
  }

  const w = BUTTON * SLOT_SPREAD
  const h = (w * c.item.height) / c.item.width
  const at = { x: CARD_WIDTH / 2 - w / 2, y: BUTTON_MIDDLE - h / 2, w, h }
  const anvilTop = new Path2D(ANVIL_TOP)

  ctx.save()
  const outside = new Path2D()
  outside.rect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  outside.addPath(anvilTop, new DOMMatrix([unit, 0, 0, unit, left, top]))
  ctx.clip(outside, 'evenodd')
  shadowOf(ctx, c, at, 'rgba(0,0,0,0.55)', 26, 46 * unit, 34 * unit)
  ctx.restore()

  ctx.save()
  ctx.setTransform(unit, 0, 0, unit, left, top)
  ctx.clip(anvilTop)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  shadowOf(ctx, c, at, 'rgba(10,18,32,0.42)', 9, 9 * unit, 3 * unit)
  shadowOf(ctx, c, at, 'rgba(30,15,6,0.3)', 9, -4 * unit, 6 * unit)
  shadowOf(ctx, c, at, 'rgba(0,0,0,0.72)', 3, 2.5 * unit, 2 * unit)
  ctx.restore()

  ctx.drawImage(c.item, at.x, at.y, at.w, at.h)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(540, BUTTON_MIDDLE, 0, 540, BUTTON_MIDDLE, 520)
  glow.addColorStop(0, `rgba(${c.glowRgb},0.12)`)
  glow.addColorStop(0.5, `rgba(${c.glowRgb},0.03)`)
  glow.addColorStop(1, `rgba(${c.glowRgb},0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.restore()
}

/** The sword's picture: the forge wall, the floor, and the sword on the anvil by the fire. */
export function paintSmithyCard(ctx: CanvasRenderingContext2D, content: CardContent): void {
  drawWall(ctx)
  drawFloor(ctx)
  drawWindowLight(ctx)
  drawAnvil(ctx, content)
}
