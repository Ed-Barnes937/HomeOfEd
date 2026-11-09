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

test('trimmings offer a metal and a paint only once something uses them', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyControls({
    shown: ['Handle made of', 'Shaft made of', 'End cap', 'Ring made of', 'Metal bands'],
    hidden: ['Metal', 'Paint', 'Spiral made of'],
  })
  await root.chooseIn('Metal bands', 'Two')
  await root.chooseIn('Metal', 'Brass')
  await root.verifyGroupSummary('The trimmings', 'Brass')
  await root.chooseIn('Handle made of', 'Metal')
  await root.verifyControls({ hidden: ['End cap', 'Ring made of'] })
  await root.chooseIn('Shaft made of', 'Painted')
  await root.verifyControls({ shown: ['Paint'] })
  await root.choose('Raised')
  await root.verifyControls({ shown: ['Spiral made of'] })
})

test("gems glow in the core's colour, and the close look casts with them", async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyControls({
    shown: ['Gems', 'Gem on the tip', 'Gem on the end', 'Tip', 'End'],
    hidden: ['How many gems', 'Gem size'],
  })
  await root.chooseIn('Gems', 'Up the shaft')
  await root.verifyControls({ shown: ['How many gems', 'Gem size'] })
  await root.verifyGroupSummary('The trimmings', 'Gems')
  await root.chooseIn('Gem on the tip', 'Crystal')
  await root.chooseIn('Gem on the end', 'Orb')
  await root.verifyControls({ hidden: ['Tip', 'End'] })
  await root.verifyStage({ gems: 7 })
  const closeUp = await root.pickUpWand()
  await closeUp.verifySpellsCast(1)
  await closeUp.verifyGems(7)
})

test('an engraving shows where and how big only once there is one', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyControls({
    shown: ['Engraving'],
    hidden: ['Where it goes', 'Engraving size'],
  })
  await root.chooseIn('Engraving', 'Scales')
  await root.verifyControls({ shown: ['Where it goes', 'Engraving size'] })
  await root.verifyGroupSummary('The trimmings', 'Scales')
  await root.chooseIn('Where it goes', 'All over')
  await root.verifyStage({ stencil: 'scales' })
  await root.verifyOptions('Where it goes', ['On the handle', 'Up the shaft', 'All over'])
  await root.chooseIn('Handle made of', 'Metal')
  await root.verifyOptions('Where it goes', ['Up the shaft', 'All over'])
})

test('a branch takes an engraving only on a turned handle', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.chooseIn('Engraving', 'Vine')
  await root.chooseIn('Kind of wand', 'Branch')
  await root.verifyControls({ hidden: ['Engraving', 'Where it goes', 'Engraving size'] })
  await root.verifyStage({ stencil: 'none' })
  await root.chooseIn('Grown or turned', 'Turned')
  await root.verifyControls({ shown: ['Engraving', 'Where it goes', 'Engraving size'] })
  await root.verifyOptions('Where it goes', ['On the handle'])
  await root.verifyStage({ stencil: 'vine' })
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

test('a branch shows its own controls and hides the ones it has no use for', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyKind('Turned')
  await root.verifyControls({ hidden: ['How bent', 'Grown or turned'] })
  await root.chooseIn('Kind of wand', 'Branch')
  await root.verifyStage({ kind: 'branch' })
  await root.verifyWandName('The Smoky Branch')
  await root.verifyControls({
    shown: ['How bent', 'How wiggly', 'Lumpy', 'Knots', 'Which branch', 'Grown or turned', 'Bumps'],
    hidden: ['Handle', 'Pattern', 'Ring', 'Carving', 'How deep', 'Ring made of'],
  })
  await root.chooseIn('Grown or turned', 'Turned')
  await root.verifyControls({ shown: ['Handle', 'Ring', 'Ring made of'], hidden: ['Carving'] })
  await root.chooseIn('Kind of wand', 'Turned')
  await root.verifyStage({ kind: 'turned' })
  await root.verifyControls({ shown: ['Carving'], hidden: ['How bent', 'Grown or turned'] })
})

test('trying another keeps the kind of wand', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.chooseIn('Kind of wand', 'Branch')
  for (let i = 0; i < 4; i++) {
    await root.tryAnother()
    await root.verifyStage({ kind: 'branch' })
  }
})

test('a wand saved before branches opens as a turned wand', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.openWithSavedWand({ wood: 'walnut', handleStyle: 'spiral', lengthCm: 35 })
  const { root } = await mountApp()
  await root.verifyStage({ wood: 'walnut', length: 35, kind: 'turned' })
  await root.verifyKind('Turned')
  await root.verifyControls({ shown: ['Carving'], hidden: ['How bent'] })
})

test('the picture of a wand downloads as a png named after it', async ({ mountApp }) => {
  const { root } = await mountApp()
  expect(await root.savePicture()).toBe('the-smoky-spiral.png')
})
