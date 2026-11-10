// SPIKE (ticket 02): screenshots of branch wands on a real GPU. Never merged.
// node apps/armoury/spike-shots.mjs <baseUrl> <outDir> [only]
import { mkdirSync } from 'node:fs'

import { chromium } from '@playwright/test'

const [base = 'http://localhost:3027', out = 'shots', only] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const turned = {
  lengthCm: 33,
  thickness: 1,
  pointy: 0.15,
  tipShape: 'rounded',
  handleStyle: 'ringed',
  handleCarving: 'none',
  endShape: 'knob',
  collarStyle: 'beadPair',
  shaftCarving: 'none',
  wood: 'walnut',
  stainColour: 'smoky',
  stainStrength: 0.7,
  stainReach: 0.5,
  core: 'starlight',
}
const branch = { ...turned, kind: 'branch', endShape: 'knob', pointy: 0.55 }

export const attempts = {
  a0_straight_turned: { ...turned },
  a1_bend_only: { ...branch, bend: 0.6 },
  a2_bend_wiggle: { ...branch, bend: 0.5, wiggle: 0.6 },
  a3_gnarled: { ...branch, bend: 0.45, wiggle: 0.5, gnarl: 0.45, knots: 4, branchSeed: 3 },
  a4_dark_gnarled: {
    ...branch,
    wood: 'walnut',
    stainColour: 'midnight',
    stainStrength: 0.85,
    stainReach: 0.9,
    bend: 0.35,
    wiggle: 0.8,
    gnarl: 0.6,
    knots: 6,
    branchSeed: 11,
    lengthCm: 32,
  },
  a5_max_everything: { ...branch, bend: 1, wiggle: 1, gnarl: 1, knots: 7, branchSeed: 5 },
  a6_lumps_only_max: { ...branch, gnarl: 1, branchSeed: 5 },
  a7_knots_no_pool: {
    ...branch,
    wood: 'maple',
    stainColour: 'smoky',
    knots: 5,
    bend: 0.3,
    gnarl: 0.3,
    knotStain: 'no',
    branchSeed: 2,
  },
  a8_knots_pool: {
    ...branch,
    wood: 'maple',
    stainColour: 'smoky',
    knots: 5,
    bend: 0.3,
    gnarl: 0.3,
    knotStain: 'yes',
    branchSeed: 2,
  },
  a9_turned_mix: {
    ...turned,
    handleStyle: 'ringed',
    collarStyle: 'ringStack',
    shaftCarving: 'shortSpiral',
    bend: 0.5,
    wiggle: 0.5,
    gnarl: 0.5,
    knots: 4,
    branchSeed: 3,
  },
  a10_pale_branch: {
    ...branch,
    wood: 'maple',
    stainColour: 'none',
    bend: 0.4,
    wiggle: 0.35,
    gnarl: 0.35,
    knots: 3,
    branchSeed: 8,
    core: 'wildwood',
  },
}

const token = (params) =>
  Buffer.from(JSON.stringify({ version: 1, wand: { params } }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})

for (const [name, params] of Object.entries(attempts)) {
  if (only && !only.split(',').includes(name)) continue
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  await page.goto(`${base}/#w=${token(params)}`)
  await page.getByRole('button', { name: 'Give the wand a wave' }).waitFor()
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${out}/${name}-box.png` })
  // Crop of the box alone, bigger.
  await page.getByRole('button', { name: 'Give the wand a wave' }).screenshot({ path: `${out}/${name}-boxcrop.png` })

  if (process.env.FULL) {
    // Roll a quarter turn in the box.
    const box = await page.getByRole('button', { name: 'Give the wand a wave' }).boundingBox()
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Give the wand a wave' }).screenshot({ path: `${out}/${name}-boxrolled.png` })

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save a picture of this wand' }).click()
    await (await download).saveAs(`${out}/${name}-sharecard.png`)

    await page.getByRole('button', { name: 'Give the wand a wave' }).click()
    await page.getByRole('dialog', { name: 'Your wand, up close' }).waitFor()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${out}/${name}-closelook.png` })
    await page.getByRole('button', { name: 'Wave it' }).click()
    await page.waitForTimeout(1400)
    await page.screenshot({ path: `${out}/${name}-wave.png` })
    await page.waitForTimeout(1400)
    await page.screenshot({ path: `${out}/${name}-spell.png` })
    await page.waitForTimeout(2500)
    // Zoom in on the held wand for surface detail.
    await page.mouse.move(720, 400)
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/${name}-zoom.png` })
    await page.getByRole('button', { name: 'Put it back' }).click()
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: 'Keep this wand' }).click()
    await page.getByRole('link', { name: /^Your shelf/ }).click()
    await page.getByRole('heading', { name: 'Your shelf' }).waitFor()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${out}/${name}-shelf.png` })
  }
  await ctx.close()
  console.log('done', name)
}
await browser.close()
