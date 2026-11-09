import { seededRandom } from '../engine/schema.ts'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export interface CardContent {
  /** The stage's capture: the wand alone, centred, longest wand spanning `captureFill`. */
  wand: HTMLCanvasElement
  captureFill: number
  /** This wand's length over the longest possible, so the tip glow lands on the tip. */
  lengthFraction: number
  number: string
  name: string
  description: string
  lore: string
  coreRgb: string
}

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
  const drawHeight = (drawWidth * c.wand.height) / c.wand.width
  ctx.drawImage(c.wand, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

  const tipX = drawWidth * c.captureFill * 0.5 * c.lengthFraction
  const glow = ctx.createRadialGradient(tipX, 0, 0, tipX, 0, 260)
  glow.addColorStop(0, `rgba(${c.coreRgb},0.65)`)
  glow.addColorStop(0.18, `rgba(${c.coreRgb},0.2)`)
  glow.addColorStop(1, `rgba(${c.coreRgb},0)`)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = glow
  ctx.fillRect(tipX - 260, -260, 520, 520)
  ctx.restore()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`
    if (ctx.measureText(next).width > maxWidth && line !== '') {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

function drawTag(ctx: CanvasRenderingContext2D, c: CardContent) {
  const x = 60
  const y = 860
  const width = 900
  const pad = 100
  const textWidth = width - pad - 40

  ctx.font = "italic 30px 'IM Fell English'"
  const descLines = wrap(ctx, c.description, textWidth)
  ctx.font = "italic 28px 'IM Fell English'"
  const loreLines = wrap(ctx, c.lore, textWidth)
  const height = 120 + descLines.length * 40 + 36 + loreLines.length * 38 + 30

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((-1.6 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 18
  const notch = 40
  ctx.beginPath()
  ctx.moveTo(notch, 0)
  ctx.lineTo(width, 0)
  ctx.lineTo(width, height)
  ctx.lineTo(notch, height)
  ctx.lineTo(0, height - notch)
  ctx.lineTo(0, notch)
  ctx.closePath()
  const paper = ctx.createLinearGradient(0, 0, width * 0.2, height)
  paper.addColorStop(0, '#ece0c6')
  paper.addColorStop(1, '#dfcfae')
  ctx.fillStyle = paper
  ctx.fill()
  ctx.shadowColor = 'transparent'

  ctx.beginPath()
  ctx.arc(36, height / 2, 11, 0, Math.PI * 2)
  ctx.fillStyle = '#20160e'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#c9b48e'
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#6b5a44'
  ctx.font = "26px 'IM Fell English SC'"
  ctx.fillText(`No. ${c.number}`, pad, 56)
  ctx.fillStyle = '#2a1f16'
  ctx.font = "64px 'IM Fell English'"
  ctx.fillText(c.name, pad, 118, textWidth)
  ctx.fillStyle = '#4a3b2b'
  ctx.font = "italic 30px 'IM Fell English'"
  let lineY = 164
  for (const line of descLines) {
    ctx.fillText(line, pad, lineY)
    lineY += 40
  }
  ctx.fillStyle = 'rgba(58,44,30,0.25)'
  ctx.fillRect(pad, lineY - 12, textWidth, 2)
  ctx.fillStyle = '#4a3b2b'
  ctx.font = "italic 28px 'IM Fell English'"
  lineY += 30
  for (const line of loreLines) {
    ctx.fillText(line, pad, lineY)
    lineY += 38
  }
  ctx.restore()
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#efe4cf'
  ctx.font = "54px 'IM Fell English'"
  ctx.fillText('Armoury', 60, 100)
  ctx.fillStyle = '#a8957a'
  ctx.font = "26px 'IM Fell English SC'"
  ctx.textAlign = 'right'
  ctx.fillText('wands made to measure', CARD_WIDTH - 60, 96)
  ctx.textAlign = 'left'
  ctx.fillText('Find yours at', 60, CARD_HEIGHT - 50)
  ctx.textAlign = 'right'
  ctx.fillText('armoury.homeofed.com', CARD_WIDTH - 60, CARD_HEIGHT - 50)
  ctx.textAlign = 'left'
}

const FONTS = [
  "64px 'IM Fell English'",
  "italic 30px 'IM Fell English'",
  "26px 'IM Fell English SC'",
]

export async function renderShareCard(content: CardContent): Promise<Blob> {
  await Promise.all(FONTS.map((f) => document.fonts.load(f)))
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d canvas')
  drawWall(ctx)
  drawCounter(ctx)
  drawBox(ctx, content)
  drawTag(ctx, content)
  drawHeader(ctx)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    ),
  )
}
