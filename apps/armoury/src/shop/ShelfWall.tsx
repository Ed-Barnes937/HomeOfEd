import { seededRandom } from '../engine/schema.ts'
import styles from './ShelfWall.module.scss'

const TONES = [
  '#2f271f',
  '#3a2f23',
  '#26232a',
  '#232925',
  '#312320',
  '#433727',
  '#202229',
  '#463b2f',
  '#2b241c',
]
const BOX_W = 53
const BOX_H = 22
const PITCH_X = 57
const PITCH_Y = 25
const COLUMNS_PER_BAY = 7
const ROWS_PER_SHELF = 4
const POST_W = 10
const PLANK_H = 9
const WIDTH = 2400
const HEIGHT = 900

function box(x: number, y: number, fill: string, label: number, kind: string): string {
  if (kind === 'missing')
    return `<rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" fill="#060403"/>`
  const pulled = kind === 'pulled'
  const at = pulled ? `translate(${x - 1.5} ${y + 1}) scale(1.06)` : `translate(${x} ${y})`
  return (
    `<g transform="${at}">` +
    (pulled ? `<rect y="3" width="${BOX_W}" height="${BOX_H}" fill="rgba(0,0,0,0.55)"/>` : '') +
    `<rect width="${BOX_W}" height="${BOX_H}" fill="${fill}"/>` +
    (kind === 'recessed'
      ? `<rect width="${BOX_W}" height="${BOX_H}" fill="rgba(0,0,0,0.35)"/>`
      : '') +
    `<rect y="${BOX_H - 2}" width="${BOX_W}" height="2" fill="rgba(0,0,0,0.3)"/>` +
    `<rect width="${BOX_W}" height="1" fill="rgba(255,235,200,${pulled ? 0.16 : 0.05})"/>` +
    `<rect x="${BOX_W * 0.24}" y="${BOX_H * 0.3}" width="${BOX_W * 0.52}" height="${BOX_H * 0.4}" fill="#dccbaa" opacity="${label.toFixed(2)}"/>` +
    `</g>`
  )
}

/** The wall of boxed wands, as one seeded SVG the browser rasterises once. */
function wallSvg(): string {
  const rand = seededRandom(90211)
  const bayWidth = COLUMNS_PER_BAY * PITCH_X + POST_W + 4
  const posts: number[] = []
  for (let x = 0; x < WIDTH; x += bayWidth) posts.push(x)
  let body = posts
    .map((x) => `<rect x="${x}" width="${POST_W}" height="${HEIGHT}" fill="url(#post)"/>`)
    .join('')
  let y = 0
  while (y < HEIGHT) {
    for (let row = 0; row < ROWS_PER_SHELF && y < HEIGHT; row++) {
      for (const post of posts) {
        for (let col = 0; col < COLUMNS_PER_BAY; col++) {
          const roll = rand()
          const kind =
            roll < 0.03 ? 'missing' : roll > 0.93 ? 'pulled' : roll < 0.2 ? 'recessed' : 'plain'
          const x = post + POST_W + 2 + col * PITCH_X + Math.round(rand() * 3 - 1.5)
          body += box(
            x,
            y + 1,
            TONES[Math.floor(rand() * TONES.length)]!,
            0.06 + rand() * 0.22,
            kind,
          )
        }
      }
      y += PITCH_Y
    }
    body += `<rect y="${y}" width="${WIDTH}" height="${PLANK_H}" fill="url(#plank)"/>`
    y += PLANK_H + 3
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<defs><linearGradient id="plank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#543a27"/><stop offset="0.4" stop-color="#3a281a"/><stop offset="1" stop-color="#24180f"/></linearGradient>` +
    `<linearGradient id="post" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1c12"/><stop offset="0.45" stop-color="#4a3322"/><stop offset="1" stop-color="#24180f"/></linearGradient></defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0705"/>${body}</svg>`
  )
}

const WALL_IMAGE = `url("data:image/svg+xml,${encodeURIComponent(wallSvg())}")`

export function ShelfWall() {
  return <div className={styles.wall} style={{ backgroundImage: WALL_IMAGE }} aria-hidden="true" />
}
