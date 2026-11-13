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

test('a tap on a jar of a full bottle announces the full message, never a count', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')

  await root.tapJar('Emberroot')

  await root.verifyAnnouncementIs('The bottle is full. Take one out to pour another.')
})

test('the jars say why they are dimmed only while the bottle is full', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyJarsNotDescribed()
  await root.pour('Frogfizz')
  await root.verifyJarsDescribedByFullMessage()
  await root.takeOut('Frogfizz')
  await root.verifyJarsNotDescribed()
})

test('taking out the same ingredient twice in a row is announced twice', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Rosehip syrup')
  await root.watchAnnouncements()

  await root.takeOutWithKeyboard('Rosehip syrup', 'Enter')
  await root.takeOutWithKeyboard('Rosehip syrup', 'Enter')

  await root.verifyAnnouncementsHeard(['Rosehip syrup taken out.', 'Rosehip syrup taken out.'])
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

test('after a take-out or an empty, focus stays in the picker', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.pour('Frogfizz')

  await root.takeOutWithKeyboard('Rosehip syrup', 'Enter')
  await root.verifyFocused('Take out Starpetal')

  await root.takeOutWithKeyboard('Frogfizz', 'Space')
  await root.verifyFocused('Take out Starpetal')

  await root.takeOutWithKeyboard('Starpetal', 'Enter')
  await root.verifyFocused('Take out Moonmilk')

  await root.takeOutWithKeyboard('Moonmilk', 'Space')
  await root.verifyFocused('Pour in Moonmilk')

  await root.pour('Frogfizz')
  await root.pour('Emberroot')
  await root.emptyBottleWithKeyboard()
  await root.verifyFocused('Pour in Moonmilk')
})

test.describe('on a phone with a keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('emptying scrolls the newly focused first jar into view', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.scrollSheetToBottom()
    await root.emptyBottleWithKeyboard()
    await root.verifyFocused('Pour in Moonmilk')
    await root.verifyFocusedInView()
  })
})

test('Try another leaves focus where the child put it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.tryAnother()
  await root.verifyFocused('Try another')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('all nine jars are in view without scrolling, empty or full, and the pours stand in one top-first column', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyAllJarsShown()
    await root.verifyAllJarsInView()
    await root.verifyHitTargetsAtLeast44()
    await root.verifyPoursInOneColumn()

    await root.pour('Frogfizz')
    await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal', 'Frogfizz'])
    await root.verifyAllJarsInView()
    await root.verifyHitTargetsAtLeast44()
    await root.verifyPoursInOneColumn()

    await root.emptyBottle()
    await root.scrollSheetToTop()
    await root.verifyAllJarsInView()
  })

  test.describe('with a finger', () => {
    test.use({ hasTouch: true })

    test('a tap on Empty the bottle leaves the sheet where it was', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.scrollSheetToBottom()
      await root.verifySheetScrolled()

      await root.tapEmptyBottle()
      await root.verifySheetStillAtBottom()
    })

    test('a tap on the last pour\'s Take out leaves the sheet where it was', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.emptyBottleWithKeyboard()
      await root.pour('Frogfizz')
      await root.scrollSheetToBottom()
      await root.verifySheetScrolled()

      await root.tapLastTakeOut()
      await root.verifySheetStillAtBottom()
    })
  })
})
