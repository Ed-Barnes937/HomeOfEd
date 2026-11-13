import { profileScopedKey } from '@hoe/accounts'
import { expect } from '@playwright/experimental-ct-react'

import { ITEMS } from './items/registry.ts'
import { LAST_SHOP_KEY } from './persistence/lastShop.ts'
import { reloadAtRoot } from './testing/address.ts'
import { setFamilyCookie } from './testing/familySession.ts'
import { smithyTest, streetTest, test } from './testing/iwftTest.tsx'
import {
  readLocalSave,
  readSaveDocument,
  seedLegacySave,
  shelfDocument,
  shelfNames,
} from './testing/localSaves.ts'

/** Local saves belong to whoever is playing (ADR 0094, estate-gate spec decisions 7 and 8). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('one player’s shelf and counter are not another’s on the same device', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await reloadAtRoot(page)
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyPlayer('Ada')
  await ada.root.rename('Acorn')
  await ada.root.keep()
  await ada.root.verifyShelfCount(1)

  await reloadAtRoot(page)
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyPlayer('Bo')
  await bo.root.verifyShelfCount(0)
  await bo.root.verifyWandName('The Smoky Spiral')

  expect(shelfNames(await readLocalSave(page, ADA.sub))).toEqual(['Acorn'])
  expect(readSaveDocument(await readLocalSave(page, ADA.sub)).working?.name).toBe('Acorn')
  expect(shelfNames(await readLocalSave(page, BO.sub))).toEqual([])
})

test('wands kept before profiles appear for every player, and the device copy is never written', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await reloadAtRoot(page)
  const legacy = shelfDocument(['From before profiles'])
  await seedLegacySave(page, legacy)
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyShelfCount(1)
  await ada.root.keep()
  await ada.root.verifyShelfCount(2)

  await reloadAtRoot(page)
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyShelfCount(1)
  const shelf = await bo.root.openShelf()
  await shelf.verifyWands(['From before profiles'])

  expect(await readLocalSave(page, null)).toBe(legacy)
})

test('signed out, the device’s own shelf is the one in use and no player is shown', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await reloadAtRoot(page)
  await seedLegacySave(page, shelfDocument(['On the device']))

  const { root } = await mountApp()
  await root.verifyNoPlayer()
  await root.verifyShelfCount(1)
  await root.rename('Spare')
  await root.keep()

  expect(shelfNames(await readLocalSave(page, null))).toEqual(['On the device', 'Spare'])
})

smithyTest(
  'one player’s swords are not another’s on the same device',
  async ({ mountApp, page }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await reloadAtRoot(page)
    await setFamilyCookie(page, ADA)

    const ada = await mountApp()
    await ada.root.verifyPlayer('Ada')
    await ada.root.rename('Needle')
    await ada.root.keep()
    await ada.root.verifyShelfCount(1)

    await reloadAtRoot(page)
    await setFamilyCookie(page, BO)
    const bo = await mountApp()
    await bo.root.verifyPlayer('Bo')
    await bo.root.verifyShelfCount(0)

    const adas = await readLocalSave(page, ADA.sub, ITEMS.sword)
    expect(shelfNames(adas, ITEMS.sword)).toEqual(['Needle'])
    expect(readSaveDocument(adas, ITEMS.sword).working?.name).toBe('Needle')
    expect(shelfNames(await readLocalSave(page, BO.sub, ITEMS.sword), ITEMS.sword)).toEqual([])
  },
)

test('the last shop stays the device’s, whoever is playing', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await reloadAtRoot(page)
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await (await root.backToStreet()).enterSmithy()

  const shop = (key: string) => page.evaluate((k) => window.localStorage.getItem(k), key)
  await expect.poll(() => shop(LAST_SHOP_KEY)).toBe('sword')
  expect(await shop(profileScopedKey(LAST_SHOP_KEY, ADA.sub))).toBeNull()
})

streetTest(
  'the street shows who is playing, and nobody when signed out',
  async ({ mountApp, page }) => {
    const first = await mountApp()
    await first.root.verifyDoors()
    await first.root.verifyNoPlayer()
    await reloadAtRoot(page)
    await setFamilyCookie(page, ADA)

    const { root } = await mountApp()
    await root.verifyDoors()
    await root.verifyPlayer('Ada')
  },
)

test.describe('on a narrow laptop', () => {
  test.use({ viewport: { width: 900, height: 600 } })

  test('the title stays clear and the player circle ends the header', async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await reloadAtRoot(page)
    await setFamilyCookie(page, { ...ADA, name: 'Bartholomew-Maximilian' })

    const { root } = await mountApp()
    await root.verifyIsShown()
    const header = await root.headerLayout()

    expect(header.navLeft).toBeGreaterThanOrEqual(header.titleRight)
    expect(header.playerRight).toBe(header.navRight)
    expect(header.navRight).toBeLessThanOrEqual(header.right)
  })
})

// Just inside each step where the smithy's header (the longer motto) gives way, and just above
// the motto's step, where it shows again beside the circle.
for (const width of [1120, 1330, 1350]) {
  smithyTest.describe(`at ${width}px`, () => {
    smithyTest.use({ viewport: { width, height: 800 } })

    smithyTest(
      'the title stays clear and the player circle ends the header',
      async ({ mountApp, page }) => {
        const first = await mountApp()
        await first.root.verifyIsShown()
        await reloadAtRoot(page)
        await setFamilyCookie(page, { ...ADA, name: 'Bartholomew-Maximilian' })

        const { root } = await mountApp()
        await root.verifyIsShown()
        const header = await root.headerLayout()

        expect(header.navLeft).toBeGreaterThanOrEqual(header.titleRight)
        expect(header.playerRight).toBe(header.navRight)
        expect(header.navRight).toBeLessThanOrEqual(header.right)
      },
    )
  })
}
