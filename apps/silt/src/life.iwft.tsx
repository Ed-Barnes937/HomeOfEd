import { expect } from '@playwright/experimental-ct-react'

import { BURIED, FLOWER, GRID_HEIGHT, MUD } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

const FLOOR = GRID_HEIGHT - 1

/**
 * The meadow through the UI (life spec §4.1-4.3): the one thing a player does -
 * scatter seed on wet ground and press play - and the one thing they should see
 * happen. Everything under it (the soak counter, the travelling budget, the
 * lifetimes) is pinned in `sim/seedBank.test.ts`, `sim/stalk.test.ts` and
 * `sim/life.test.ts`; what this case is for is that the chain runs end to end in
 * the app, in a worker, at the real tick rate.
 */
test('seed scattered on a wet bed banks, germinates and blooms', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // A wide, wet bed along the floor. The widest brush at the floor row paints
  // several cells deep, and mud is dense enough to stay where it lands.
  await root.selectElement('mud')
  await root.selectBrush(3)
  await root.dragPaint({ x: 100, y: FLOOR }, { x: 200, y: FLOOR })
  expect(await root.countSpecies(MUD)).toBeGreaterThan(100)

  // A thin scatter of seed above it, and thin on purpose: seed that cannot bury
  // is litter that roofs the bed it fell on, and a roofed bank is a dormant one.
  await root.selectElement('seed')
  await root.selectBrush(0)
  await root.dragPaint({ x: 140, y: FLOOR - 10 }, { x: 170, y: FLOOR - 10 })

  await root.play()

  // Into the soil first (`seed + mud`, p 0.1 a contact tick)...
  await expect.poll(() => root.countSpecies(BURIED)).toBeGreaterThan(0)
  // ...and out of it as a plant: germination under an open sky, a sprout, a tip
  // climbing 6-10 cells at p 0.3, and a flower on the top of the stem.
  await expect.poll(() => root.countSpecies(FLOWER)).toBeGreaterThan(0)
})
