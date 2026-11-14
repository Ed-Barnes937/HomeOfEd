// Draws the placeholder ingredient sprite sheet to the layout in docs/adr/0112, for the cutter to cut.
//   pnpm --filter armoury run ingredients:placeholders <out.png>   (needs Node 22.6 or later)
// Each ingredient is a lit orb in its own colour with a hint of its trait, on the jar tile's ground
// colour. The PNG is a build input: write it outside the repo, never commit it.
/* global console */
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'

import { INGREDIENTS } from '../src/potion/ingredients.ts'

export const SHEET_SIDE = 2048
export const GROUND = '#0a070b'
const CELL = SHEET_SIDE / 3
const RADIUS = CELL * 0.33

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const mix = (hex, towards, amount) => {
  const [from, to] = [channels(hex), channels(towards)]
  const blended = from.map((c, i) => Math.round(c + (to[i] - c) * amount))
  return `#${blended.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
const lighter = (hex, amount) => mix(hex, '#ffffff', amount)
const darker = (hex, amount) => mix(hex, '#000000', amount)

const star = (x, y, r, fill) => {
  const t = r * 0.18
  return `<path d="M${x} ${y - r}L${x + t} ${y - t}L${x + r} ${y}L${x + t} ${y + t}L${x} ${y + r}L${x - t} ${y + t}L${x - r} ${y}L${x - t} ${y - t}Z" fill="${fill}"/>`
}

const spiral = (stroke) => {
  const points = Array.from({ length: 120 }, (_, i) => {
    const angle = i * 0.14
    const r = RADIUS * (0.12 + i * 0.00525)
    return `${(r * Math.cos(angle)).toFixed(1)} ${(r * Math.sin(angle)).toFixed(1)}`
  })
  return `<path d="M${points.join('L')}" fill="none" stroke="${stroke}" stroke-width="${RADIUS * 0.07}" stroke-linecap="round" opacity="0.75"/>`
}

const hints = {
  glow: (colour) =>
    `<circle r="${RADIUS * 0.5}" fill="${lighter(colour, 0.6)}" opacity="0.55" filter="url(#soft)"/>`,
  glitter: (colour) =>
    [
      star(-RADIUS * 0.35, -RADIUS * 0.3, RADIUS * 0.26, lighter(colour, 0.9)),
      star(RADIUS * 0.38, -RADIUS * 0.05, RADIUS * 0.17, lighter(colour, 0.85)),
      star(-RADIUS * 0.1, RADIUS * 0.42, RADIUS * 0.2, lighter(colour, 0.9)),
      star(RADIUS * 0.3, RADIUS * 0.5, RADIUS * 0.1, lighter(colour, 0.8)),
    ].join(''),
  fizz: (colour) =>
    [
      [-0.3, 0.25, 0.2],
      [0.25, 0.3, 0.14],
      [0.05, -0.1, 0.17],
      [0.4, -0.2, 0.09],
      [-0.1, 0.55, 0.09],
    ]
      .map(
        ([x, y, r]) =>
          `<circle cx="${RADIUS * x}" cy="${RADIUS * y}" r="${RADIUS * r}" fill="${lighter(colour, 0.7)}" fill-opacity="0.3" stroke="${lighter(colour, 0.85)}" stroke-width="${RADIUS * 0.035}"/>`,
      )
      .join(''),
  swirl: (colour) => spiral(lighter(colour, 0.75)),
  clear: (colour) =>
    [
      `<ellipse cx="${-RADIUS * 0.3}" cy="${-RADIUS * 0.38}" rx="${RADIUS * 0.3}" ry="${RADIUS * 0.17}" transform="rotate(-35 ${-RADIUS * 0.3} ${-RADIUS * 0.38})" fill="#fff" opacity="0.8"/>`,
      `<circle cx="${RADIUS * 0.4}" cy="${RADIUS * 0.4}" r="${RADIUS * 0.07}" fill="${lighter(colour, 0.8)}" opacity="0.8"/>`,
    ].join(''),
  cloud: (colour) =>
    [
      [-0.35, 0.3, 0.32],
      [0.1, 0.38, 0.38],
      [0.45, 0.22, 0.28],
      [-0.05, 0.05, 0.3],
    ]
      .map(
        ([x, y, r]) =>
          `<circle cx="${RADIUS * x}" cy="${RADIUS * y}" r="${RADIUS * r}" fill="${lighter(colour, 0.55)}" opacity="0.45"/>`,
      )
      .join(''),
  murk: (colour) => `<circle r="${RADIUS * 0.6}" fill="${darker(colour, 0.5)}" opacity="0.4"/>`,
}

const cell = (item, index) => {
  const x = (index % 3) * CELL + CELL / 2
  const y = Math.floor(index / 3) * CELL + CELL / 2
  const c = item.colour
  return `<g transform="translate(${x} ${y})">
    <circle r="${RADIUS * 1.4}" fill="url(#glow-${item.id})"/>
    <circle r="${RADIUS}" fill="url(#orb-${item.id})" stroke="${lighter(c, 0.45)}" stroke-opacity="0.5" stroke-width="${RADIUS * 0.025}"/>
    <g clip-path="url(#clip)">${hints[item.trait](c)}</g>
    <ellipse cx="${-RADIUS * 0.38}" cy="${-RADIUS * 0.5}" rx="${RADIUS * 0.22}" ry="${RADIUS * 0.12}" transform="rotate(-35 ${-RADIUS * 0.38} ${-RADIUS * 0.5})" fill="#fff" opacity="0.35"/>
  </g>`
}

const gradients = (item) => `
  <radialGradient id="glow-${item.id}"><stop offset="0.7" stop-color="${item.colour}" stop-opacity="0.32"/><stop offset="1" stop-color="${item.colour}" stop-opacity="0"/></radialGradient>
  <radialGradient id="orb-${item.id}" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="${lighter(item.colour, 0.5)}"/><stop offset="0.5" stop-color="${item.colour}"/><stop offset="1" stop-color="${darker(item.colour, 0.4)}"/></radialGradient>`

export const placeholderSvg =
  () => `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_SIDE}" height="${SHEET_SIDE}" viewBox="0 0 ${SHEET_SIDE} ${SHEET_SIDE}">
  <defs>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${RADIUS * 0.12}"/></filter>
    <clipPath id="clip"><circle r="${RADIUS}"/></clipPath>
    ${INGREDIENTS.map(gradients).join('')}
  </defs>
  <rect width="${SHEET_SIDE}" height="${SHEET_SIDE}" fill="${GROUND}"/>
  ${INGREDIENTS.map(cell).join('')}
</svg>`

export async function drawPlaceholderSheet(outFile) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: SHEET_SIDE, height: SHEET_SIDE } })
    await page.setContent(`<body style="margin:0;background:${GROUND}">${placeholderSvg()}</body>`)
    await page.screenshot({ path: outFile, type: 'png' })
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outFile = process.argv[2]
  if (!outFile?.endsWith('.png')) {
    console.error('usage: node scripts/ingredient-placeholder-sheet.mjs <out.png>')
    process.exit(2)
  }
  await drawPlaceholderSheet(outFile)
  console.log(`wrote ${resolve(outFile)}`)
}
