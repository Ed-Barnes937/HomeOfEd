import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('a shared link opens the same wand, name and all, for someone else', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.choose('Walnut')
  await first.root.choose('Emberstone')
  await first.root.rename('Firefly')
  const number = await first.root.wandNumber()
  const link = await first.root.share()
  expect(link).toContain('#w=')

  await first.root.openAsNewVisitor(link)
  const { root } = await mountApp()
  await root.verifyWandName('Firefly')
  await root.verifyStage({ wood: 'walnut', core: 'emberstone' })
  expect(await root.wandNumber()).toBe(number)
})

test('a mangled link opens like a first visit rather than an error', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.choose('Maple')
  const link = await first.root.share()

  await first.root.openAsNewVisitor(link.slice(0, -10))
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyWandName('The Smoky Spiral')
})
