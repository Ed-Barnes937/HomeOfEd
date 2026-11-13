import { expect } from '@playwright/experimental-ct-react'

import { apothecaryTest as test, failedApothecaryStageTest } from './testing/iwftTest.tsx'
import { ShopPom } from './testing/ShopPom.ts'

test('a first visit finds a potion on the table, labelled and ready', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyAt('/potions')
  await root.verifyPotionName('Sparkling Starpetal Tonic')
  expect(await root.potionNumber()).toMatch(/^No\. \d{4}$/)
  await root.verifyDescription(
    'Three pours in a teardrop flask. Cloudy, then swirly, then sparkly.',
  )
  await root.verifyHint('Tap the bottle to pick it up')
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal', shape: 'teardrop', glass: 'clear' })
})

test('choosing the bottle and its finish changes what is drawn and the card', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const number = await root.potionNumber()

  await root.chooseIn('Shape', 'Gourd bottle')
  await root.chooseIn('Glass', 'Amber')
  await root.chooseIn('Stopper', 'Sealed with wax')
  await root.chooseIn('Label', 'Tag on a string')

  await root.verifyStage({ shape: 'gourd', glass: 'amber', stopper: 'wax', label: 'tag' })
  await root.verifyPotionName('Sparkling Starpetal Potion')
  await root.verifyDescription('Three pours in a gourd bottle. Cloudy, then swirly, then sparkly.')
  expect(await root.potionNumber()).not.toBe(number)
})

test('Try another keeps a kept bottle, never pours fewer than two, and can be put back', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  // A fixed seed, so Try another always makes the same potion.
  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.chooseIn('Shape', 'Tall bottle')
  await root.lock('bottle')
  const before = { name: await root.potionName(), pours: await root.stageFact('pours') }

  await root.tryAnother()
  await root.verifyStage({ shape: 'tall' })
  const pours = await root.stageFact('pours')
  expect(pours).not.toBe(before.pours)
  expect(pours.split(',').length).toBeGreaterThanOrEqual(2)

  await root.putBack()
  await root.verifyPotionName(before.name)
  await root.verifyStage({ pours: before.pours, shape: 'tall' })
})

test('a renamed potion keeps its name and its shape after a reload', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.chooseIn('Shape', 'Round flask')
  await first.root.rename('Fizz')
  await first.root.verifyPotionName('Fizz')
  await first.root.reload()

  const { root } = await mountApp()
  await root.verifyPotionName('Fizz')
  await root.verifyStage({ shape: 'round' })
})

test('the potion and the wand each stay as they were left', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.chooseIn('Shape', 'Gourd bottle')
  const wands = await (await first.root.backToStreet()).enterWandShop()
  await wands.verifyWandName('The Smoky Spiral')
  await wands.choose('Oak')
  await wands.reload()

  const { root } = await mountApp()
  await root.verifyStage({ shape: 'gourd' })
  await (await root.backToStreet()).enterWandShop()
  await new ShopPom(page).verifyStage({ wood: 'oak' })
})

test('the street still has only its two open doors', async ({ mountApp }) => {
  const { root } = await mountApp()
  const street = await root.backToStreet()
  await street.verifyOnlyOpenShopsAreDoors()
})

test('a tap on the bottle shows it up close, and it waits for a tap to uncork', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const closeUp = await root.openCloseLook()
  await closeUp.verifyFlourishes(0)
  await closeUp.tapPotion()
  await closeUp.verifyFlourishes(1)
  await closeUp.putBack()
  await closeUp.verifyIsHidden()
})

test('Picture saves a png named after the potion', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.rename('Fizz')
  expect(await root.savePicture()).toBe('fizz.png')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("the sheet's tabs are the potion's parts", async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyTabs(['Pours', 'Bottle', 'Finish'])
    await root.openTab('Bottle')
    await root.chooseIn('Shape', 'Square shoulders')
    await root.verifyStage({ shape: 'shoulder' })
  })
})

failedApothecaryStageTest(
  'a potion stage that fails to load leaves the table, card and controls working',
  async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyNoStage()
    await root.chooseIn('Shape', 'Gourd bottle')
    await root.verifyDescription(
      'Three pours in a gourd bottle. Cloudy, then swirly, then sparkly.',
    )
  },
)
