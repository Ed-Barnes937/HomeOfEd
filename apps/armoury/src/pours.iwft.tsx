import { expect } from '@playwright/experimental-ct-react'

import { apothecaryTest as test } from './testing/iwftTest.tsx'

test('pouring adds a layer on top, in the stage, the list and the card', async ({ mountApp }) => {
  const { root } = await mountApp()
  const before = { name: await root.potionName(), line: await root.description() }

  await root.pour('Frogfizz')

  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal,frogfizz' })
  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])
  expect(await root.potionName()).not.toBe(before.name)
  expect(await root.description()).not.toBe(before.line)
})

test('four pours fill the bottle, and a fifth tap changes nothing', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')
  await root.verifyFull()

  await root.tapJar('Emberroot')
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal,frogfizz' })
  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])
})

test('taking out a middle pour shifts the ones above down, in order', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')

  await root.takeOut('Rosehip syrup')

  await root.verifyStage({ pours: 'moonmilk,starpetal,frogfizz' })
  await root.verifyPours(['Moonmilk', 'Starpetal', 'Frogfizz'])
})

test('taking a pour out of a full bottle lets the jars pour again', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')
  await root.verifyFull()
  await root.takeOut('Moonmilk')
  await root.verifyNotFull()
  await root.pour('Emberroot')
  await root.verifyPours(['Rosehip syrup', 'Starpetal', 'Frogfizz', 'Emberroot'])
})

test('emptying the bottle leaves nothing in it and the card says so', async ({ mountApp }) => {
  const { root } = await mountApp()

  await root.emptyBottle()

  await root.verifyStage({ pours: '' })
  await root.verifyPours([])
  await root.verifyDescription('An empty teardrop flask, waiting for a pour.')
  await root.verifyNoEmptyButton()
})

test('the same jars in another order make a potion with another name', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.emptyBottle()
  await root.pour('Frogfizz')
  await root.pour('Emberroot')
  const first = await root.potionName()

  await root.emptyBottle()
  await root.pour('Emberroot')
  await root.pour('Frogfizz')

  expect(await root.potionName()).not.toBe(first)
})

test('Try another keeps the pours while the group is locked and changes them when not', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.lockPours()
  await root.tryAnother()
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal' })

  await root.lockPours()
  await root.tryAnother()
  expect(await root.stageFact('pours')).not.toBe('moonmilk,rosehip,starpetal')
})

test('a pour survives a reload, and Put the last one back restores the old pours', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.pour('Frogfizz')
  await first.root.reload()

  const { root } = await mountApp()
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal,frogfizz' })
  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])

  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.tryAnother()
  await root.putBack()
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal,frogfizz' })
  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])
})

test('a polite live region says what was poured and taken out', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')
  await root.verifyAnnouncement('Frogfizz poured in. Four of four.')
  await root.takeOut('Rosehip syrup')
  await root.verifyAnnouncement('Rosehip syrup taken out.')
  await root.emptyBottle()
  await root.verifyAnnouncement('The bottle is empty.')
})

test('with the keyboard alone, Tab reaches a jar and Enter pours it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pourWithKeyboard('Frogfizz')
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal,frogfizz' })
  await root.verifyFull()
  await root.verifyJarStillFocusable('Emberroot')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the Pours tab holds all nine jars and the four pours in a sheet no taller than the others', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyAllJarsShown()
    await root.pour('Frogfizz')
    await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])
    await root.verifyPoursReachableInSheet(500)
  })
})
