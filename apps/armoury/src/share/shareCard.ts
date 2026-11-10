import type { ShopView } from '../shop/shopView.ts'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export interface CardContent {
  /** The stage's capture: the item alone, centred, the longest spanning `captureFill`. */
  item: HTMLCanvasElement
  captureFill: number
  /** This item's length over the longest possible, so a tip glow lands on the tip. */
  lengthFraction: number
  number: string
  name: string
  description: string
  lore: string
  /** Its light as `r,g,b`. */
  glowRgb: string
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

function drawHeader(ctx: CanvasRenderingContext2D, motto: string) {
  ctx.fillStyle = '#efe4cf'
  ctx.font = "54px 'IM Fell English'"
  ctx.fillText('Armoury', 60, 100)
  ctx.fillStyle = '#a8957a'
  ctx.font = "26px 'IM Fell English SC'"
  ctx.textAlign = 'right'
  ctx.fillText(motto, CARD_WIDTH - 60, 96)
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

export async function renderShareCard(
  view: Pick<ShopView, 'copy' | 'paintCard'>,
  content: CardContent,
): Promise<Blob> {
  await Promise.all(FONTS.map((f) => document.fonts.load(f)))
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d canvas')
  view.paintCard(ctx, content)
  drawTag(ctx, content)
  drawHeader(ctx, view.copy.motto)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    ),
  )
}
