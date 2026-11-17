import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the parts live in tabs on a sheet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openTab('Core')
  await root.choose('Storm glass')
  await root.verifyStage({ core: 'stormglass' })
  await root.openTab('Wood')
  await root.choose('Oak')
  await root.verifyStage({ wood: 'oak' })
})

test('on a phone a wand group keeps its lock in the header row of the panel', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.openTab('Core')
  const lock = (await page
    .getByRole('button', { name: /^Keep .* when trying another$/ })
    .boundingBox())!
  const panel = (await page.getByRole('tabpanel').boundingBox())!
  expect(lock.y).toBeGreaterThanOrEqual(panel.y)
})
