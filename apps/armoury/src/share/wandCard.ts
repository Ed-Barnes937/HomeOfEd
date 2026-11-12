import { seededRandom } from '../engine/schema.ts'
import { CARD_HEIGHT, CARD_WIDTH, type CardContent } from './shareCard.ts'

const WALL_BOTTOM = 600
const TONES = [
  '#2f271f',
  '#3a2f23',
  '#26232a',
  '#232925',
  '#312320',
  '#433727',
  '#202229',
  '#463b2f',
]

function drawWall(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom(7321)
  ctx.fillStyle = '#0a0705'
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
  for (let y = 0; y < WALL_BOTTOM; y += 4 * 38 + 16) {
    for (let row = 0; row < 4; row++) {
      for (let x = -20; x < CARD_WIDTH; x += 88) {
        const roll = rand()
        ctx.fillStyle = roll < 0.03 ? '#060403' : TONES[Math.floor(rand() * TONES.length)]!
        ctx.fillRect(x, y + row * 38, 82, 34)
        if (roll >= 0.03) {
          ctx.fillStyle = `rgba(220,203,170,${0.06 + rand() * 0.2})`
          ctx.fillRect(x + 20, y + row * 38 + 10, 42, 14)
        }
      }
    }
    const plank = ctx.createLinearGradient(0, y + 152, 0, y + 166)
    plank.addColorStop(0, '#543a27')
    plank.addColorStop(1, '#24180f')
    ctx.fillStyle = plank
    ctx.fillRect(0, y + 152, CARD_WIDTH, 14)
  }
  const shade = ctx.createLinearGradient(0, 0, 0, WALL_BOTTOM)
  shade.addColorStop(0, 'rgba(8,5,3,0.8)')
  shade.addColorStop(0.45, 'rgba(8,5,3,0.25)')
  shade.addColorStop(1, 'rgba(8,5,3,0.45)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
  const vignette = ctx.createRadialGradient(540, 600, 100, 540, 600, 760)
  vignette.addColorStop(0, 'rgba(8,5,3,0)')
  vignette.addColorStop(1, 'rgba(8,5,3,0.8)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, CARD_WIDTH, WALL_BOTTOM)
}

function drawCounter(ctx: CanvasRenderingContext2D) {
  const top = ctx.createLinearGradient(0, WALL_BOTTOM, 0, CARD_HEIGHT)
  top.addColorStop(0, '#4a3322')
  top.addColorStop(0.02, '#2e2015')
  top.addColorStop(0.4, '#20160e')
  top.addColorStop(1, '#120c08')
  ctx.fillStyle = top
  ctx.fillRect(0, WALL_BOTTOM, CARD_WIDTH, CARD_HEIGHT - WALL_BOTTOM)
  const lamp = ctx.createRadialGradient(540, 660, 0, 540, 660, 600)
  lamp.addColorStop(0, 'rgba(255,190,110,0.13)')
  lamp.addColorStop(1, 'rgba(255,190,110,0)')
  ctx.fillStyle = lamp
  ctx.fillRect(0, WALL_BOTTOM, CARD_WIDTH, CARD_HEIGHT - WALL_BOTTOM)
}

function drawBox(ctx: CanvasRenderingContext2D, c: CardContent) {
  const width = 960
  const height = 168
  const inset = 16
  ctx.save()
  ctx.translate(540, 640)
  ctx.rotate((-6 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 30
  const box = ctx.createLinearGradient(0, -height / 2, 0, height / 2)
  box.addColorStop(0, '#45382b')
  box.addColorStop(1, '#352a20')
  ctx.fillStyle = box
  ctx.fillRect(-width / 2, -height / 2, width, height)
  ctx.shadowColor = 'transparent'
  const velvet = ctx.createRadialGradient(0, -12, 20, 0, -12, width * 0.55)
  velvet.addColorStop(0, '#243049')
  velvet.addColorStop(0.55, '#171d2e')
  velvet.addColorStop(1, '#0b0e17')
  ctx.fillStyle = velvet
  ctx.fillRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2)

  const innerWidth = width - inset * 2
  const drawWidth = (innerWidth * 0.97) / c.captureFill
  const drawHeight = (drawWidth * c.item.height) / c.item.width
  ctx.drawImage(c.item, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

  const tipX = drawWidth * c.captureFill * 0.5 * c.lengthFraction
  const glow = ctx.createRadialGradient(tipX, 0, 0, tipX, 0, 260)
  glow.addColorStop(0, `rgba(${c.glowRgb},0.65)`)
  glow.addColorStop(0.18, `rgba(${c.glowRgb},0.2)`)
  glow.addColorStop(1, `rgba(${c.glowRgb},0)`)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = glow
  ctx.fillRect(tipX - 260, -260, 520, 520)
  ctx.restore()
}

/** The wand's picture: the shop wall, the counter and the wand in its open box. */
export function paintWandCard(ctx: CanvasRenderingContext2D, content: CardContent): void {
  drawWall(ctx)
  drawCounter(ctx)
  drawBox(ctx, content)
}
