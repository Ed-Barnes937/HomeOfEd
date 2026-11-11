import { CARD_HEIGHT, CARD_WIDTH, type CardContent } from './shareCard.ts'

/** The sword's picture: a plain dark ground with the sword laid across it. */
export function paintSmithyCard(ctx: CanvasRenderingContext2D, content: CardContent): void {
  ctx.fillStyle = '#120d0a'
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const drawWidth = (CARD_WIDTH * 0.9) / content.captureFill
  const drawHeight = (drawWidth * content.item.height) / content.item.width
  ctx.drawImage(
    content.item,
    (CARD_WIDTH - drawWidth) / 2,
    600 - drawHeight / 2,
    drawWidth,
    drawHeight,
  )
}
