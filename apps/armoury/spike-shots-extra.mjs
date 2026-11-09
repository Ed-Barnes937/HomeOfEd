// SPIKE (ticket 02): controls panel and phone close look. Never merged.
import { chromium } from '@playwright/test'

const [base, out] = process.argv.slice(2)
const token = (params) =>
  Buffer.from(JSON.stringify({ version: 1, wand: { params } }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const wand = {
  kind: 'branch',
  lengthCm: 38,
  thickness: 0.85,
  pointy: 0.55,
  wood: 'cherry',
  stainColour: 'smoky',
  bend: 1,
  wiggle: 0.6,
  gnarl: 0.4,
  knots: 4,
  branchSeed: 3,
}
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let page = await desk.newPage()
await page.goto(`${base}/#w=${token(wand)}`)
await page.getByRole('button', { name: 'Give the wand a wave' }).waitFor()
await page.waitForTimeout(2500)
await page.getByText('The handle', { exact: false }).first().scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/controls-handle-thumbs.png` })
await page.getByText('The branch (spike)').first().scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/controls-branch-group.png` })
await page.getByRole('button', { name: 'Give the wand a wave' }).screenshot({ path: `${out}/max-bow-38cm-boxcrop.png` })
await desk.close()

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})
page = await phone.newPage()
await page.goto(`${base}/#w=${token(wand)}`)
await page.getByRole('button', { name: 'Give the wand a wave' }).waitFor()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}/phone-box.png` })
await page.getByRole('button', { name: 'Give the wand a wave' }).click()
await page.getByRole('dialog', { name: 'Your wand, up close' }).waitFor()
await page.waitForTimeout(1300)
await page.screenshot({ path: `${out}/phone-wave.png` })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${out}/phone-closelook.png` })
await phone.close()
await browser.close()
console.log('done')
