import { expect } from '@playwright/experimental-ct-react'

import { INGREDIENTS } from './potion/ingredients.ts'
import { apothecaryTest, test } from './testing/iwftTest.tsx'

const PICTURES = '**/ingredients/*.webp'

apothecaryTest('every jar shows its ingredient picture', async ({ mountApp }) => {
  const { root } = await mountApp()

  for (const { label } of INGREDIENTS) await root.verifyJarPicture(label)
})

apothecaryTest(
  'a picture that does not load leaves the swatch in its jar',
  async ({ mountApp, page }) => {
    await page.route('**/ingredients/emberroot.webp', (route) => route.abort())
    const { root } = await mountApp()

    await root.verifyJarSwatchOnly('Emberroot')
    await root.verifyJarPicture('Starpetal')
    await root.verifyAllJarsShown()
  },
)

test('a wand visit does not download the ingredient pictures', async ({ mountApp, page }) => {
  const asked: string[] = []
  await page.route(PICTURES, (route) => {
    asked.push(route.request().url())
    return route.continue()
  })

  const { root } = await mountApp()
  await root.verifyIsShown()

  await page.waitForLoadState('networkidle')
  expect(asked).toEqual([])
})
