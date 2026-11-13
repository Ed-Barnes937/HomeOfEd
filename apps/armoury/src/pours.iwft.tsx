import { expect } from '@playwright/experimental-ct-react'

import { normalise } from './engine/schema.ts'
import { potionSchema } from './potion/potionSchema.ts'
import { withPours } from './potion/pours.ts'
import { encodeShare, SHARE_HASH_PREFIX } from './share/shareLink.ts'
import { FULL_MESSAGE, MIXED_MESSAGE } from './testing/ApothecaryPom.ts'
import { apothecaryTest as test } from './testing/iwftTest.tsx'
import { ShopPom } from './testing/ShopPom.ts'

const MIXED_LINK = `/shared${SHARE_HASH_PREFIX}${encodeShare('potion', {
  params: normalise(potionSchema, {
    ...withPours(['bluebell', 'starpetal', 'emberroot']),
    mixed: 'yes',
  }),
  name: 'Fizzed',
})}`

test('the first visit has a full bottle, its jars shut with the full message', async ({
  mountApp,
}) => {
  const { root } = await mountApp()

  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal'])
  await root.verifyBottleHeading('In the bottle')
  await root.verifyFull()
  await root.verifyJarsDescribedBy(FULL_MESSAGE)
})

test('the same ingredient can go in twice, and three pours make an unmixed bottle', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const before = { name: await root.potionName(), line: await root.description() }
  await root.emptyBottle()

  await root.pour('Frogfizz')
  await root.pour('Frogfizz')
  await root.pour('Bluebell dew')

  await root.verifyStage({ pours: 'frogfizz,frogfizz,bluebell', mixed: 'no' })
  await root.verifyPours(['Frogfizz', 'Frogfizz', 'Bluebell dew'])
  await root.verifyAnnouncement('Bluebell dew poured in. Three of three. Tap the bottle to mix it.')
  expect(await root.potionName()).not.toBe(before.name)
  expect(await root.description()).not.toBe(before.line)
})

test('a tap on a jar of a full bottle pours nothing and announces the full message again', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.watchAnnouncements()

  await root.tapJar('Emberroot')
  await root.tapJar('Emberroot')

  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal' })
  await root.verifyPours(['Moonmilk', 'Rosehip syrup', 'Starpetal'])
  await root.verifyAnnouncementsHeard([FULL_MESSAGE, FULL_MESSAGE])
})

test('the jars are not described while the bottle has room', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.emptyBottle()
  await root.verifyNotShut()
  await root.verifyJarsNotDescribed()

  await root.pour('Frogfizz')
  await root.pour('Frogfizz')
  await root.verifyNotShut()
  await root.verifyJarsNotDescribed()

  await root.pour('Frogfizz')
  await root.verifyFull()
  await root.verifyJarsDescribedBy(FULL_MESSAGE)
})

test('emptying a full bottle opens the jars again, and the bottle pours from the bottom', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyFull()

  await root.emptyBottle()
  await root.verifyNotShut()
  await root.verifyPours([])
  await root.pour('Emberroot')
  await root.pour('Puffcap')

  await root.verifyPours(['Emberroot', 'Puffcap'])
  await root.verifyStage({ pours: 'emberroot,puffcap' })
})

test('no Take out button exists, full, part full or empty', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyNoTakeOutButton()
  await root.emptyBottle()
  await root.verifyNoTakeOutButton()
  await root.pour('Frogfizz')
  await root.verifyNoTakeOutButton()
})

test('emptying the bottle leaves nothing in it, the card says so, and the button goes', async ({
  mountApp,
}) => {
  const { root } = await mountApp()

  await root.emptyBottle()

  await root.verifyStage({ pours: '' })
  await root.verifyPours([])
  await root.verifyDescription('An empty teardrop flask, waiting for three ingredients.')
  await root.verifyNoEmptyButton()
})

test('the same ingredients in another order make a potion with another name', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.emptyBottle()
  await root.pour('Frogfizz')
  await root.pour('Emberroot')
  await root.pour('Bluebell dew')
  const first = await root.potionName()

  await root.emptyBottle()
  await root.pour('Emberroot')
  await root.pour('Frogfizz')
  await root.pour('Bluebell dew')

  expect(await root.potionName()).not.toBe(first)
})

test.describe('a mixed potion', () => {
  test('shuts the jars with the mixed message, and says so in the heading', async ({
    mountApp,
    page,
  }) => {
    await ShopPom.openAt(page, MIXED_LINK)
    const { root } = await mountApp()

    await root.verifyStage({ pours: 'bluebell,starpetal,emberroot', mixed: 'yes' })
    await root.verifyMixed()
    await root.verifyJarsDescribedBy(MIXED_MESSAGE)
    await root.verifyBottleHeading('Mixed in the bottle')
    await root.verifyPours(['Bluebell dew', 'Starpetal', 'Emberroot'])
  })

  test('takes no pour, and announces the mixed message when a jar is tapped', async ({
    mountApp,
    page,
  }) => {
    await ShopPom.openAt(page, MIXED_LINK)
    const { root } = await mountApp()
    const before = { name: await root.potionName(), line: await root.description() }

    await root.tapJar('Frogfizz')
    await root.tapJar('Bluebell dew')

    await root.verifyStage({ pours: 'bluebell,starpetal,emberroot', mixed: 'yes' })
    await root.verifyPours(['Bluebell dew', 'Starpetal', 'Emberroot'])
    expect(await root.potionName()).toBe(before.name)
    expect(await root.description()).toBe(before.line)
    await root.verifyAnnouncementIs(MIXED_MESSAGE)
  })

  test('is unmixed and emptied by Empty the bottle, and the heading goes back', async ({
    mountApp,
    page,
  }) => {
    await ShopPom.openAt(page, MIXED_LINK)
    const { root } = await mountApp()

    await root.emptyBottle()

    await root.verifyStage({ pours: '', mixed: 'no' })
    await root.verifyPours([])
    await root.verifyBottleHeading('In the bottle')
    await root.verifyNotShut()
    await root.pour('Frogfizz')
    await root.verifyStage({ pours: 'frogfizz', mixed: 'no' })
  })

  test('has no Mixed control of its own on the Pours tab', async ({ mountApp, page }) => {
    await ShopPom.openAt(page, MIXED_LINK)
    const { root } = await mountApp()
    await root.verifyPours(['Bluebell dew', 'Starpetal', 'Emberroot'])
    await expect(page.getByText('Not mixed')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: /^Mixed/ })).toHaveCount(0)
  })

  test('keeps its three ingredients and the mixed state through Try another while Pours is locked', async ({
    mountApp,
    page,
  }) => {
    await ShopPom.openAt(page, MIXED_LINK)
    const { root } = await mountApp()
    await page.evaluate(() => {
      Math.random = () => 0.25
    })

    await root.lockPours()
    await root.tryAnother()

    await root.verifyStage({ pours: 'bluebell,starpetal,emberroot', mixed: 'yes' })
  })
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
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal', mixed: 'no' })

  await root.lockPours()
  await root.tryAnother()
  expect(await root.stageFact('pours')).not.toBe('moonmilk,rosehip,starpetal')
})

test('the pours survive a reload, and Put the last one back restores them after Try another', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.emptyBottle()
  await first.root.pour('Frogfizz')
  await first.root.pour('Frogfizz')
  await first.root.pour('Emberroot')
  await first.root.reload()

  const { root } = await mountApp()
  await root.verifyStage({ pours: 'frogfizz,frogfizz,emberroot' })
  await root.verifyPours(['Frogfizz', 'Frogfizz', 'Emberroot'])

  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.tryAnother()
  await root.putBack()
  await root.verifyStage({ pours: 'frogfizz,frogfizz,emberroot' })
  await root.verifyPours(['Frogfizz', 'Frogfizz', 'Emberroot'])
})

test('a polite live region says what was poured and when the bottle is empty', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.emptyBottle()
  await root.verifyAnnouncement('The bottle is empty.')
  await root.pour('Frogfizz')
  await root.verifyAnnouncement('Frogfizz poured in. One of three.')
  await root.pour('Rosehip syrup')
  await root.verifyAnnouncement('Rosehip syrup poured in. Two of three.')
  await root.pour('Frogfizz')
  await root.verifyAnnouncement('Frogfizz poured in. Three of three. Tap the bottle to mix it.')
})

test('with the keyboard alone, Tab reaches a jar and Enter or Space pours it', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.emptyBottleWithKeyboard()

  await root.pourWithKeyboard('Frogfizz', 'Enter')
  await root.verifyStage({ pours: 'frogfizz' })
  await root.pourWithKeyboard('Bluebell dew', 'Space')
  await root.verifyStage({ pours: 'frogfizz,bluebell' })
  await root.verifyJarStillFocusable('Emberroot')
})

test('Empty the bottle works with Enter and with Space, and focus lands on the first jar', async ({
  mountApp,
}) => {
  const { root } = await mountApp()

  await root.emptyBottleWithKeyboard('Enter')
  await root.verifyStage({ pours: '' })
  await root.verifyFocused('Pour in Emberroot')

  await root.pour('Frogfizz')
  await root.pour('Puffcap')
  await root.emptyBottleWithKeyboard('Space')
  await root.verifyStage({ pours: '' })
  await root.verifyFocused('Pour in Emberroot')
})

test('after Empty the bottle with a mouse, focus is on the first jar too', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.emptyBottle()
  await root.verifyFocused('Pour in Emberroot')
})

test.describe('on a phone with a keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('emptying scrolls the newly focused first jar into view', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.scrollSheetToBottom()
    await root.emptyBottleWithKeyboard()
    await root.verifyFocused('Pour in Emberroot')
    await root.verifyFocusedInView()
  })
})

test('Try another leaves focus where the child put it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.tryAnother()
  await root.verifyFocused('Try another')
})

for (const size of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  test.describe(`on a ${size.width} by ${size.height} phone`, () => {
    test.use({ viewport: size })

    test('the nine jars, the rows and the buttons are laid out the same whatever is in the bottle', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyAllJarsShown()
      await root.verifyHitTargetsAtLeast44()
      await root.verifyPoursInOneColumn()
      if (size.height >= 800) await root.verifyAllJarsInView()

      await root.emptyBottle()
      await root.scrollSheetToTop()
      await root.verifyHitTargetsAtLeast44()
      await root.verifyPoursInOneColumn()
      if (size.height >= 800) await root.verifyAllJarsInView()

      await root.pour('Frogfizz')
      await root.verifyPoursInOneColumn()
      if (size.height >= 800) await root.verifyAllJarsInView()
    })

    test('a mixed bottle lays out the same, with its longer message', async ({
      mountApp,
      page,
    }) => {
      await ShopPom.openAt(page, MIXED_LINK)
      const { root } = await mountApp()
      await root.verifyMixed()
      await root.verifyHitTargetsAtLeast44()
      await root.verifyPoursInOneColumn()
      if (size.height >= 800) await root.verifyAllJarsInView()
    })
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.describe('with a finger', () => {
    test.use({ hasTouch: true })

    test('a tap on Empty the bottle leaves the sheet where it was', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.scrollSheetToBottom()
      await root.verifySheetScrolled()

      await root.tapEmptyBottle()
      await root.verifySheetStillAtBottom()
    })
  })
})
