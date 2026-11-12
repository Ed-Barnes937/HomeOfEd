import { expect } from '@playwright/experimental-ct-react'

import { streetTest as test } from './testing/iwftTest.tsx'
import { ShelfPom } from './testing/ShelfPom.ts'

test('a first visit lands on the street with two doors', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyDoors()
  await root.verifyAt('/street')
})

test('only the wand shop and the smithy are open; the other shops stay shut', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyOnlyOpenShopsAreDoors()
  await root.verifyLitShops(['wands', 'smithy'])
  await root.tapShutShop('potions')
  await root.verifyAt('/street')
})

test('a door can be reached and opened from the keyboard', async ({ mountApp }) => {
  const { root } = await mountApp()
  const wands = await root.enterWandShopByKeyboard()
  await wands.verifyAt('/wands')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a first visit opens at the wand shop, with a signpost for each open shop', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyDoorsInView(['Go into the wand shop'])
    await root.verifyDoorOutOfView('Go into the smithy')
    await root.verifySignposts(['Thistlewick Wands', 'The Ember Anvil'])
    await root.verifyHint('Slide along the street, then tap a shop.')
    await root.verifyNoHint('Click a shop to go in.')
  })

  test('a signpost brings its shop into view without going in, and the shop front goes in', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.showOnStreet('The Ember Anvil')
    await root.verifyDoorWhollyInView('Go into the smithy')
    await root.verifyDoorOutOfView('Go into the wand shop')
    await root.verifyAt('/street')
    await root.verifyTitleInView()
    const smithy = await root.enterSmithy()
    await smithy.verifyAt('/swords')
  })

  test('the street opens at the shop the visitor was last in', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.showOnStreet('The Ember Anvil')
    const street = await (await root.enterSmithy()).backToStreet()
    await street.verifyDoorWhollyInView('Go into the smithy')
    await street.verifyDoorOutOfView('Go into the wand shop')
  })

  test('keyboard focus brings a shop into view', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.showOnStreet('The Ember Anvil')
    await root.focusDoor('Go into the wand shop')
    await root.verifyDoorWhollyInView('Go into the wand shop')
  })
})

test('with a pointer, the lights are off at rest, come up under the pointer, and nothing is picked', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyLights('smithy', '0')
  await root.pointAt('Go into the smithy')
  await root.verifyLights('smithy', '1')
  await root.verifyLights('wands', '0')
  await root.verifyNoEnterLink()
  await root.verifyHint('Click a shop to go in.')
})

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a tap picks a shop and lights it, and its Enter link goes in', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyShopsArePicked(['Thistlewick Wands', 'The Ember Anvil'])
    await root.verifyPicked(null)
    await root.verifyLights('wands', '0')
    await root.tapShop('Thistlewick Wands')
    await root.verifyPicked('Thistlewick Wands')
    await root.verifyAt('/street')
    await root.pressEnterFor('Thistlewick Wands')
    await root.verifyAt('/wands')
  })

  test('a signpost slides to its shop and picks it, and the pick is gone after leaving', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.showOnStreet('The Ember Anvil')
    await root.verifyPicked('The Ember Anvil')
    await root.verifySignpostCurrent('The Ember Anvil')
    const smithy = await root.enterSmithyWithEnter()
    await smithy.verifyAt('/swords')
    const street = await smithy.backToStreet()
    await street.verifyPicked(null)
  })

  test('a keyboard can pick a shop and go in', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.pickByKeyboard('Thistlewick Wands')
    await root.verifyPicked('Thistlewick Wands')
    await root.pressEnterKey()
    await root.verifyAt('/wands')
  })
})

test.describe('on a touch screen held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('a tap on another shop moves the pick, the street clears it, and a second tap goes in', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyNoHint('Click a shop to go in.')
    await root.tapShop('Thistlewick Wands')
    await root.verifyPicked('Thistlewick Wands')
    await root.tapShop('The Ember Anvil')
    await root.verifyPicked('The Ember Anvil')
    await root.verifyLights('wands', '0')
    await root.tapShutShop('potions')
    await root.verifyPicked(null)
    await root.tapShop('The Ember Anvil')
    await root.tapShop('The Ember Anvil')
    await root.verifyAt('/swords')
  })
})

test('each door opens its shop, and the way back leads to the street', async ({ mountApp }) => {
  const { root } = await mountApp()
  const wands = await root.enterWandShop()
  await wands.verifyAt('/wands')
  const street = await wands.backToStreet()
  const smithy = await street.enterSmithy()
  await smithy.verifyAt('/swords')
  await (await smithy.backToStreet()).verifyDoors()
})

test('a reload on the street stays on the street', async ({ mountApp }) => {
  const first = await mountApp()
  await (await (await first.root.enterSmithy()).backToStreet()).reload()
  const { root } = await mountApp()
  await root.verifyDoors()
})

test('a returning visitor opens in the wand shop they were last in', async ({ mountApp }) => {
  const first = await mountApp()
  const wands = await first.root.enterWandShop()
  await wands.rename('Twiglet')
  await wands.reload()
  await mountApp()
  await wands.verifyWandName('Twiglet')
  await wands.verifyAt('/wands')
})

test('a returning visitor opens in the smithy they were last in', async ({ mountApp }) => {
  const first = await mountApp()
  const smithy = await first.root.enterSmithy()
  await smithy.rename('Pip')
  await smithy.reload()
  await mountApp()
  await smithy.verifySwordName('Pip')
  await smithy.verifyAt('/swords')
})

test.describe('share links', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('an old wand link opens the wand shop with that wand, and then forgets the link', async ({
    mountApp,
  }) => {
    const first = await mountApp()
    const wands = await first.root.enterWandShop()
    await wands.choose('Walnut')
    await wands.rename('Firefly')
    const link = await wands.share()
    expect(new URL(link).pathname).toBe('/')

    await wands.openAsNewVisitor(link)
    await mountApp()
    await wands.verifyWandName('Firefly')
    await wands.verifyStage({ wood: 'walnut' })
    await wands.verifyAt('/wands')

    await wands.choose('Oak')
    await wands.reload()
    await mountApp()
    await wands.verifyStage({ wood: 'oak' })
  })

  test('a sword link opens the smithy with that sword, whatever shop was last', async ({
    mountApp,
  }) => {
    const first = await mountApp()
    const smithy = await first.root.enterSmithy()
    await smithy.chooseKind('Dagger')
    await smithy.rename('Pip')
    const link = await smithy.share()
    await (await smithy.backToStreet()).enterWandShop()

    await smithy.openAsNewVisitor(link)
    await mountApp()
    await smithy.verifySwordName('Pip')
    await smithy.verifyStage({ family: 'dagger' })
    await smithy.verifyAt('/swords')
  })

  test('a wand link to the shelf still loads the wand, and then forgets the link', async ({
    mountApp,
  }) => {
    const first = await mountApp()
    const wands = await first.root.enterWandShop()
    await wands.choose('Walnut')
    await wands.rename('Firefly')
    const link = await wands.share()

    await first.root.openAsNewVisitor(link, '/shelf')
    await mountApp()
    const shelf = new ShelfPom(first.page)
    await shelf.verifyIsShown()
    await shelf.verifyAt('/shelf')
    await shelf.backTo('the counter')
    await wands.verifyWandName('Firefly')
    await wands.verifyStage({ wood: 'walnut' })
  })
})

test('an old save with no last shop sees the street once, and keeps its wand and shelf', async ({
  mountApp,
}) => {
  const first = await mountApp()
  await first.root.openWithOldSave({
    working: { params: { wood: 'walnut' }, name: 'Shadow' },
    shelf: [{ params: { wood: 'oak' }, name: 'Keeper' }],
  })
  const { root } = await mountApp()
  await root.verifyDoors()
  const wands = await root.enterWandShop()
  await wands.verifyWandName('Shadow')
  await wands.verifyStage({ wood: 'walnut' })
  const shelf = await wands.openShelf()
  await shelf.verifyWands(['Keeper'])
})

test('from the shelf, the way back returns to the shop that was last', async ({ mountApp }) => {
  const first = await mountApp()
  const smithy = await first.root.enterSmithy()
  await (await smithy.openShelf()).backTo('the anvil')
  await smithy.verifyIsShown()
  const wands = await (await smithy.backToStreet()).enterWandShop()
  await (await wands.openShelf()).backTo('the counter')
  await wands.verifyIsShown()
})

test('an empty shelf talks about the shop that was last', async ({ mountApp }) => {
  const first = await mountApp()
  const smithy = await first.root.enterSmithy()
  const shelf = await smithy.openShelf()
  await shelf.verifyEmpty(
    'Every sword you keep gets a box and a label.',
    'Keep a sword and its box goes here',
  )
  await shelf.backTo('the anvil')
  const wands = await (await smithy.backToStreet()).enterWandShop()
  await wands.openShelf()
  await shelf.verifyEmpty(
    'Every wand you keep gets a box and a label.',
    'Keep a wand and its box goes here',
  )
})

test('an address the shop does not know leads to the street', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.openAt('/no-such-shop')
  const { root } = await mountApp()
  await root.verifyDoors()
  await root.verifyAt('/street')
})
