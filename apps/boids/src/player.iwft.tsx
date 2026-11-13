import type { Page } from '@playwright/test'

import type { BoidsPagePom } from './testing/BoidsPagePom.ts'
import { setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** Who is playing, as their initial in a circle in the top-right corner (estate-gate 29). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

async function openAsAda(
  page: Page,
  mountApp: () => Promise<{ root: BoidsPagePom }>,
): Promise<BoidsPagePom> {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)
  const { root } = await mountApp()
  await root.verifyIsShown()
  return root
}

test('signed out, no player is named', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoPlayer()
})

for (const { device, viewport } of [
  { device: 'laptop', viewport: { width: 1280, height: 800 } },
  { device: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test.describe(`on a ${device}`, () => {
    test.use({ viewport })

    test('the player circle holds the top-right corner, clear of the panel and its FAB', async ({
      mountApp,
      page,
    }) => {
      const root = await openAsAda(page, mountApp)
      await root.verifyPlayer('Ada')
      await root.verifyPlayerInCornerClearOfControls('Ada')

      await root.collapsePanel()
      await root.verifyCollapsed()
      await root.verifyPlayerInCornerClearOfControls('Ada')
    })
  })
}
