import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('a first visit finds a wand on the counter, tagged and ready', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyWandName('The Smoky Spiral')
  await root.verifyDescription('Twelve inches, cherry, starlight core. Steady.')
  await root.verifyStage({ wood: 'cherry', core: 'starlight', length: 30.5 })
})

test('choosing parts changes the wand on the counter and its tag', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.choose('Oak')
  await root.choose('Moonstone')
  await root.verifyStage({ wood: 'oak', core: 'moonstone' })
  await root.verifyDescription('Twelve inches, oak, moonstone core. Steady.')
})

test('bumps and raised spirals show their own controls only when they apply', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyControls({
    shown: ['Bumps', 'Spiral', 'How deep'],
    hidden: ['How many bumps', 'How big', 'How tall'],
  })
  await root.choose('Knobbly')
  await root.verifyControls({ shown: ['How many bumps', 'How big'] })
  await root.choose('Raised')
  await root.verifyControls({ shown: ['How tall'], hidden: ['How deep'] })
  await root.choose('No bumps')
  await root.verifyControls({ hidden: ['How many bumps', 'How big'] })
})

test('decorations offer a metal and a paint only once something uses them', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyControls({
    shown: ['Handle made of', 'Shaft made of', 'End cap', 'Ring made of', 'Metal bands'],
    hidden: ['Metal', 'Paint', 'Spiral made of'],
  })
  await root.chooseIn('Metal bands', 'Two')
  await root.chooseIn('Metal', 'Brass')
  await root.verifyGroupSummary('Decorations', 'Brass')
  await root.chooseIn('Handle made of', 'Metal')
  await root.verifyControls({ hidden: ['End cap'] })
  await root.chooseIn('Shaft made of', 'Painted')
  await root.verifyControls({ shown: ['Paint'] })
  await root.choose('Raised')
  await root.verifyControls({ shown: ['Spiral made of'] })
})

test('tapping the wand lifts it out to turn and wave, then it goes back', async ({ mountApp }) => {
  const { root } = await mountApp()
  const closeUp = await root.pickUpWand()
  await closeUp.verifyWand('The Smoky Spiral')
  await closeUp.verifySpellsCast(1)
  await closeUp.tapWand()
  await closeUp.wave()
  await closeUp.verifySpellsCast(3)
  await closeUp.putBack()
  await closeUp.verifyIsHidden()
})

test('the close look closes from the keyboard or by tapping the dark', async ({ mountApp }) => {
  const { root } = await mountApp()
  let closeUp = await root.pickUpWand()
  await closeUp.pressEscape()
  await closeUp.verifyIsHidden()
  closeUp = await root.pickUpWand()
  await closeUp.tapAway()
  await closeUp.verifyIsHidden()
})

test('trying another wand can be undone', async ({ mountApp }) => {
  const { root } = await mountApp()
  const number = await root.wandNumber()
  await root.tryAnother()
  await expect.poll(() => root.wandNumber()).not.toBe(number)
  await root.putBack()
  await root.verifyWandName('The Smoky Spiral')
  expect(await root.wandNumber()).toBe(number)
  await root.verifyNothingToPutBack()
})

test('a locked part survives trying another', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.choose('Wildwood')
  await root.lock('core')
  for (let i = 0; i < 4; i++) {
    await root.tryAnother()
    await root.verifyStage({ core: 'wildwood' })
  }
})

test('a renamed wand keeps its name on the tag', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.rename('Twiglet')
  await root.verifyWandName('Twiglet')
  await root.choose('Maple')
  await root.verifyWandName('Twiglet')
})

test('the wand on the counter is still there after a reload', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.choose('Walnut')
  await first.root.rename('Shadow')
  await first.root.reload()
  const { root } = await mountApp()
  await root.verifyWandName('Shadow')
  await root.verifyStage({ wood: 'walnut' })
})

test('the picture of a wand downloads as a png named after it', async ({ mountApp }) => {
  const { root } = await mountApp()
  expect(await root.savePicture()).toBe('the-smoky-spiral.png')
})
