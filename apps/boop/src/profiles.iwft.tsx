import { expect } from '@playwright/experimental-ct-react'

import { seedFamily } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import {
  boop,
  readLocalSave,
  saveDocument,
  savedNames,
  seedLegacySave,
} from './testing/localSaves.ts'

/** Local saves belong to whoever is playing (ADR 0094, estate-gate spec decisions 7 and 8). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('one player’s boops are not another’s on the same device', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: ADA })

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.startBlank()
  await ada.root.toggleCell('kick', 0)
  await ada.root.openBoops()
  const name = await ada.root.saveBoop()
  await ada.root.closeBoops()

  await page.reload()
  await seedFamily(page, { session: BO })
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  await bo.root.openBoops()
  await bo.root.verifyBoopCount(0)

  expect(savedNames(await readLocalSave(page, ADA.sub))).toEqual([name])
  expect(savedNames(await readLocalSave(page, BO.sub))).toEqual([])
})

test('boops saved before profiles appear for every player, and stay on the device', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacySave(page, saveDocument([boop('from before profiles')]))
  await seedFamily(page, { session: ADA })

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.openBoops()
  await ada.root.verifyBoopName(0, 'from before profiles')
  await ada.root.closeBoops()

  await page.reload()
  await seedFamily(page, { session: BO })
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  await bo.root.openBoops()
  await bo.root.verifyBoopName(0, 'from before profiles')

  expect(savedNames(await readLocalSave(page, null))).toEqual(['from before profiles'])
})
