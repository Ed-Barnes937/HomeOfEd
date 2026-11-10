// Screenshots of the real stages on the real GPU (ANGLE Metal), for judging by eye.
// node apps/armoury/scripts/gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]
// The set file is { "<name>": { "kind": "wand" | "sword", "params": { ... } } }.
/* global console, document */
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [base, out, setFile, only] = args.filter((a) => !a.startsWith('--'))
if (!base || !out || !setFile) {
  console.error(
    'usage: gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]',
  )
  process.exit(2)
}
const picture = flags.has('--picture')
const reducedMotion = flags.has('--reduced-motion')
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
const CLOSE_FRAMES = [1200, 2400, 3600, 4800, 7000]
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
      const ctx = await browser.newContext({
        viewport: view.viewport,
        deviceScaleFactor: view.deviceScaleFactor,
        reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
        acceptDownloads: true,
      })
      const page = await ctx.newPage()
      const shot = (what) => join(out, `${name}-${view.tag}-${what}.png`)
      await page.goto(`${base}/#w=${token(kind, params)}`)

      const renderer = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none'
      })
      if (!/ANGLE Metal/.test(renderer)) throw new Error(`not the real GPU: ${renderer}`)

      const item = page.locator('[data-testid="counter"] button[aria-haspopup="dialog"]')
      await item.locator('canvas').waitFor()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(SETTLE_MS)
      await page.screenshot({ path: shot('scene') })
      await item.screenshot({ path: shot('box') })

      if (picture) {
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: /^Save a picture/ }).click()
        await (await download).saveAs(shot('picture'))
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
      await ctx.close()
      console.log(`${name} ${view.tag}`)
    }
  }
} finally {
  await browser.close()
}
