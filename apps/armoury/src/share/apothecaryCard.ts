import { CARD_HEIGHT, CARD_WIDTH, type CardContent } from './shareCard.ts'

const TABLE_TOP = 760

/** The potion's picture: a dark room, a table, the bottle on it. */
export function paintApothecaryCard(ctx: CanvasRenderingContext2D, content: CardContent): void {
  const room = ctx.createRadialGradient(540, 520, 40, 540, 520, 900)
  room.addColorStop(0, '#2a1d2b')
  room.addColorStop(1, '#0a070b')
  ctx.fillStyle = room
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  ctx.fillStyle = '#1b1218'
  ctx.fillRect(0, TABLE_TOP, CARD_WIDTH, CARD_HEIGHT - TABLE_TOP)
  ctx.fillStyle = '#3a2836'
  ctx.fillRect(0, TABLE_TOP, CARD_WIDTH, 6)

  const { item } = content
  const drawHeight = 620
  const drawWidth = (drawHeight * item.width) / item.height
  ctx.drawImage(item, CARD_WIDTH / 2 - drawWidth / 2, TABLE_TOP - drawHeight, drawWidth, drawHeight)

  const glow = ctx.createRadialGradient(540, TABLE_TOP - 260, 0, 540, TABLE_TOP - 260, 360)
  glow.addColorStop(0, `rgba(${content.glowRgb},0.28)`)
  glow.addColorStop(1, `rgba(${content.glowRgb},0)`)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.globalCompositeOperation = 'source-over'
}
