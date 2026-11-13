import { expect } from '@playwright/experimental-ct-react'

import {
  LEGACY_DOODLE,
  readDoodle,
  seedLegacyDoodle,
  setFamilyCookie,
  storedStrokes,
} from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** A doodle belongs to whoever is drawing (ADR 0094, estate-gate spec decisions 7 and 8). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('one player’s doodle is not another’s on the same device', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.drawStroke({ x: 30, y: 30 }, { x: 120, y: 120 })
  await expect.poll(() => storedStrokes(page, ADA.sub)).toBe(1)

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  expect((await bo.root.counts()).strokes).toBe(0)

  await page.reload()
  await setFamilyCookie(page, ADA)
  const adaAgain = await mountApp()
  await adaAgain.root.verifyIsShown()
  expect((await adaAgain.root.counts()).strokes).toBe(1)

  expect(await storedStrokes(page, ADA.sub)).toBe(1)
  expect(await readDoodle(page, null)).toBeNull()
})

test('a doodle from before profiles opens for every player, and the device copy is never written', async ({
  mountApp,
  page,
}) => {
  const legacy = JSON.stringify(LEGACY_DOODLE)
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacyDoodle(page, legacy)
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  expect((await ada.root.counts()).strokes).toBe(1)
  await ada.root.drawStroke({ x: 30, y: 30 }, { x: 120, y: 120 })
  await expect.poll(() => storedStrokes(page, ADA.sub)).toBe(2)

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  expect((await bo.root.counts()).strokes).toBe(1)

  await page.reload()
  await setFamilyCookie(page, ADA)
  const adaAgain = await mountApp()
  await adaAgain.root.verifyIsShown()
  expect((await adaAgain.root.counts()).strokes).toBe(2)

  expect(await readDoodle(page, null)).toBe(legacy)
})

test('the player drawing is named in the header', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPlayerShown('Ada')
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
]) {
  test(`at ${viewport.width}px the player circle ends the header, titled with a long name in full`, async ({
    mountApp,
    page,
  }) => {
    await page.setViewportSize(viewport)
    const first = await mountApp()
    await first.root.verifyIsShown()
    await page.reload()
    await setFamilyCookie(page, { ...ADA, name: 'Wilhelmina Bartholomew-Fairweath' })

    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPlayerShown('Wilhelmina Bartholomew-Fairweath')
    await root.verifyPlayerEndsHeader('Wilhelmina Bartholomew-Fairweath')
  })
}

test('signed out, no player is named', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoPlayerShown()
})
