// Screenshots of the real stages on the real GPU (ANGLE Metal), for judging by eye.
// node apps/armoury/scripts/gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]
//   [--clay] [--views=desk,phone] [--box-only] [--close=1200,7000] [--focus=tip,hilt] [--focus-only] [--rolls=20,-40]
// The set file is { "<name>": { "kind": "wand" | "sword", "params": { ... } } }.
// --clay draws a sword in plain grey and --focus adds zooms on the tip or hilt (dev server only);
// --box-only skips the close look; --rolls turns the zoomed sword by each angle (degrees) in turn.
/* global console, document, URLSearchParams */
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')))
const options = Object.fromEntries(
  args.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')),
)
const [base, out, setFile, only] = args.filter((a) => !a.startsWith('--'))
if (!base || !out || !setFile) {
  console.error(
    'usage: gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]',
  )
  process.exit(2)
}
const picture = flags.has('--picture')
const reducedMotion = flags.has('--reduced-motion')
const clay = flags.has('--clay')
const boxOnly = flags.has('--box-only')
const viewTags = options.views ? new Set(options.views.split(',')) : null
const focuses = options.focus ? options.focus.split(',') : []
const focusOnly = flags.has('--focus-only')
const rolls = options.rolls ? options.rolls.split(',').map(Number) : []
// The close look rolls 0.007 radians per pixel dragged across the item.
const PX_PER_DEGREE = Math.PI / 180 / 0.007
const wanted = only ? new Set(only.split(',')) : null

const set = JSON.parse(readFileSync(setFile, 'utf8'))
mkdirSync(out, { recursive: true })

// The share fragment's payload names the item by its kind: { version: 1, wand: { params } }.
const token = (kind, params) =>
  Buffer.from(JSON.stringify({ version: 1, [kind]: { params } })).toString('base64url')

const views = [
  { tag: 'desk', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { tag: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
]
// Milliseconds after the tap: rising, the wave or flourish, the spell or glint, the glow, at rest.
const CLOSE_FRAMES = options.close
  ? options.close.split(',').map(Number)
  : [1200, 2400, 3600, 4800, 7000]
// Textures and the HDRI load after the stage chunk; this is time for them to upload and draw.
const SETTLE_MS = 3500

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})
try {
  for (const [name, { kind, params }] of Object.entries(set)) {
    if (wanted && !wanted.has(name)) continue
    for (const view of views) {
      if (viewTags && !viewTags.has(view.tag)) continue
      const ctx = await browser.newContext({
        viewport: view.viewport,
        deviceScaleFactor: view.deviceScaleFactor,
        reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
        acceptDownloads: true,
      })
      const page = await ctx.newPage()
      const shot = (what) => join(out, `${name}-${view.tag}-${what}.png`)
      // A wand opens at the root as it always has; a sword goes straight to its shop.
      const path = kind === 'sword' ? `/swords${clay ? '?clay' : ''}` : '/'
      await page.goto(`${base}${path}#w=${token(kind, params)}`)

      const renderer = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none'
      })
      if (!/ANGLE Metal/.test(renderer)) throw new Error(`not the real GPU: ${renderer}`)

      const item = page.locator('[data-testid="counter"] button[aria-haspopup="dialog"]')
      await item.locator('canvas').waitFor()
      if (!focusOnly) {
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(SETTLE_MS)
        await page.screenshot({ path: shot('scene') })
        await item.screenshot({ path: shot('box') })

        if (picture) {
          const download = page.waitForEvent('download')
          await page.getByRole('button', { name: /^Save a picture/ }).click()
          await (await download).saveAs(shot('picture'))
        }

        if (boxOnly) {
          await ctx.close()
          console.log(`${name} ${view.tag}`)
          continue
        }
        await item.click()
        await page.getByRole('dialog').waitFor()
        let waited = 0
        for (const ms of CLOSE_FRAMES) {
          await page.waitForTimeout(ms - waited)
          waited = ms
          await page.screenshot({ path: shot(`close-${ms}`) })
        }
        await page.mouse.move(view.viewport.width / 2, view.viewport.height * 0.4)
        for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120)
        await page.waitForTimeout(1500)
        await page.screenshot({ path: shot('zoom') })
        for (const degrees of rolls) {
          const x = view.viewport.width / 2
          const y = view.viewport.height * 0.4
          await page.mouse.move(x, y)
          await page.mouse.down()
          await page.mouse.move(x, y + degrees * PX_PER_DEGREE, { steps: 12 })
          // A pause before letting go, so it doesn't carry on spinning.
          await page.waitForTimeout(200)
          await page.mouse.up()
          await page.waitForTimeout(600)
          await page.screenshot({ path: shot(`roll${degrees}`) })
        }
      }
      for (const focus of kind === 'sword' ? focuses : []) {
        const query = new URLSearchParams({ focus })
        if (clay) query.set('clay', '')
        await page.goto(`${base}/swords?${query}#w=${token(kind, params)}`)
        await item.locator('canvas').waitFor()
        await page.waitForTimeout(SETTLE_MS)
        await item.click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(CLOSE_FRAMES[0])
        await page.mouse.move(view.viewport.width / 2, view.viewport.height * 0.4)
        for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120)
        await page.waitForTimeout(1500)
        await page.screenshot({ path: shot(`zoom-${focus}`) })
      }
      await ctx.close()
      console.log(`${name} ${view.tag}`)
    }
  }
} finally {
  await browser.close()
}
