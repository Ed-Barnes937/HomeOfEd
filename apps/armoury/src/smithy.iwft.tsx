import { expect } from '@playwright/experimental-ct-react'

import type { ChoiceParam } from './engine/schema.ts'
import { swordSchema } from './sword/swordSchema.ts'
import { smithyTest as test } from './testing/iwftTest.tsx'
import { ShopPom } from './testing/ShopPom.ts'

test('a first visit finds a sword on the anvil, tagged and ready', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySwordName('The Steel Warden')
  expect(await root.swordNumber()).toMatch(/^No\. \d{4}$/)
  await root.verifyDescription('inches, satin steel, iron hilt.')
  await root.verifyStage({ family: 'knight', guard: 'straight', grip: 'leather', pommel: 'wheel' })
})

test('choosing parts changes the sword on the anvil and its tag', async ({ mountApp }) => {
  const { root } = await mountApp()
  const tag = await root.description()
  const length = await root.stageFact('length-mm')

  await root.chooseIn('Steel', 'Mirror')
  await root.chooseIn('Guard', 'Wings')
  await root.chooseIn('Pommel', 'Pear')
  await root.chooseIn('Runes', 'In the groove')
  await root.chooseIn('Gems', 'In the pommel')
  await root.setSlider('Length', 1)

  await root.verifyStage({ steel: 'bright', guard: 'winged', pommel: 'pear', runes: 'fuller' })
  await root.verifyStage({ gems: '1' })
  expect(Number(await root.stageFact('length-mm'))).toBeGreaterThan(Number(length))
  expect(await root.description()).not.toBe(tag)
  await root.verifyDescription('mirror steel')
})

test('controls show only when they apply to the Kind', async ({ mountApp }) => {
  const { root } = await mountApp()
  const family = swordSchema.params.find((d): d is ChoiceParam => d.key === 'family')!
  await root.verifyOptions(
    'Kind of sword',
    family.options.map((o) => o.label),
  )
  await root.verifyControls({
    shown: ['Guard', 'Wrapped in', 'Pommel', 'Tip', 'How far'],
    hidden: ['Curve', 'Edges', 'Disc shape'],
  })
  await root.chooseKind('Sabre')
  await root.verifyControls({ shown: ['Curve'], hidden: ['How bent'] })
  await root.chooseKind("Knight's sword")
  await root.verifyControls({ hidden: ['Curve'] })
})

test("choosing a Kind shows that Kind's own sword", async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.chooseIn('Guard', 'Curved')
  await root.chooseKind('Dagger')
  await root.verifyKind('Dagger')
  await root.verifyStage({
    family: 'dagger',
    guard: 'straight',
    grip: 'cord',
    pommel: 'wheel',
    tip: 'longPoint',
  })
  await root.chooseKind('Sabre')
  await root.verifyStage({ family: 'sabre', grip: 'leather', pommel: 'cap', tip: 'curvedPoint' })
})

test('Try another keeps the Kind and a kept part, and the last one can be put back', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  // A fixed seed, so Try another always makes the same sword.
  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.chooseKind('Longsword')
  await root.chooseIn('Guard', 'Curved')
  await root.lock('guard')
  const before = { name: await root.swordName(), length: await root.stageFact('length-mm') }

  await root.tryAnother()
  await root.verifyKind('Longsword')
  await root.verifyStage({ family: 'longsword', guard: 'curved' })
  expect(await root.stageFact('length-mm')).not.toBe(before.length)

  await root.putBack()
  await root.verifySwordName(before.name)
  await root.verifyStage({ lengthMm: before.length })
})

test('a renamed sword keeps its name and shape after a reload', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.chooseKind('Greatsword')
  await first.root.rename('Old Oak')
  await first.root.verifySwordName('Old Oak')
  await first.root.reload()

  const { root } = await mountApp()
  await root.verifySwordName('Old Oak')
  await root.verifyStage({ family: 'greatsword' })
})

test.describe('sharing', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('a sword link opens the same sword at the smithy for someone else', async ({ mountApp }) => {
    const first = await mountApp()
    await first.root.chooseKind('Dagger')
    await first.root.chooseIn('Steel', 'Black')
    await first.root.rename('Pip')
    const number = await first.root.swordNumber()
    const link = await first.root.share()
    expect(link).toContain('#w=')

    await first.root.openAsNewVisitor(link)
    const { root } = await mountApp()
    await root.verifySwordName('Pip')
    await root.verifyStage({ family: 'dagger', steel: 'dark' })
    expect(await root.swordNumber()).toBe(number)
  })
})

test('the wand and the sword each stay as they were left', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.chooseKind('Dagger')
  const wands = new ShopPom(page)
  await (await first.root.openShelf()).backToCounter()
  await wands.verifyWandName('The Smoky Spiral')
  await wands.choose('Oak')
  await wands.reload()

  const { root } = await mountApp()
  await root.verifyStage({ family: 'dagger' })
  await (await root.openShelf()).backToCounter()
  await wands.verifyStage({ wood: 'oak' })
})

test('a tap on the sword shows it up close, and it shines again with each tap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const closeUp = await root.openCloseLook()
  await closeUp.verifyFlourishes(1)
  await closeUp.tapSword()
  await closeUp.tapSword()
  await closeUp.verifyFlourishes(3)
  await closeUp.putBack()
  await closeUp.verifyIsHidden()
})

test('Picture saves a png named after the sword', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.rename('Pip')
  expect(await root.savePicture()).toBe('pip.png')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("the sheet's tabs are the sword's parts", async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyTabs(['Metal', 'Blade', 'Tip', 'Guard', 'Grip', 'Pommel', 'Extras'])
    await root.openTab('Guard')
    await root.chooseIn('Guard', 'Wings')
    await root.verifyStage({ guard: 'winged' })
  })
})
