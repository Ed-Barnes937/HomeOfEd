import type { Page } from '@playwright/test'

import { setFamilyCookie } from './testing/familySession.ts'
import type { HomePagePom } from './testing/HomePagePom.ts'
import { test } from './testing/iwftTest.tsx'

/** Who is playing, as their initial in a circle at the end of each top bar (estate-gate 29). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

async function openAsAda(
  page: Page,
  mountApp: () => Promise<{ root: HomePagePom }>,
): Promise<HomePagePom> {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)
  const { root } = await mountApp()
  await root.verifyIsShown()
  return root
}

test('signed out, neither top bar names a player', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoPlayer()
  await root.clickLevel('beginner')
  await root.verifyWotdPageIsShown()
  await root.verifyNoPlayer()
})

for (const { device, viewport } of [
  { device: 'laptop', viewport: { width: 1280, height: 800 } },
  { device: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test.describe(`on a ${device}`, () => {
    test.use({ viewport })

    test('the player circle ends the picker’s top bar and the word’s', async ({
      mountApp,
      page,
    }) => {
      const root = await openAsAda(page, mountApp)
      await root.verifyPlayer('Ada')
      await root.verifyPlayerEndsHeader('Ada')
      await root.verifyNoHorizontalOverflow()

      await root.clickLevel('intermediate')
      await root.verifyWotdPageIsShown()
      await root.verifyPlayer('Ada')
      await root.verifyPlayerEndsHeader('Ada')
      await root.verifyNoHorizontalOverflow()
    })
  })
}

// The toggle and circle need 110px beside a 141px wordmark: centred from 430px, nudged left below.
for (const { width, centred } of [
  { width: 430, centred: true },
  { width: 390, centred: false },
  { width: 320, centred: false },
]) {
  test.describe(`on a ${width}px phone`, () => {
    test.use({ viewport: { width, height: 844 } })

    test('the picker’s top bar keeps its wordmark clear beside the player circle', async ({
      mountApp,
      page,
    }) => {
      const root = await openAsAda(page, mountApp)
      if (centred) await root.verifyWordmarkCentred()
      await root.verifyWordmarkClearOfItsNeighbours()
      await root.verifyPlayerEndsHeader('Ada')
      await root.verifyNoHorizontalOverflow()
    })
  })
}
