import { expect } from '@playwright/experimental-ct-react'

import {
  readDoodle,
  runAsNativeShell,
  setFamilyCookie,
  storedStrokes,
} from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** The Capacitor shell is outside the estate and behaves as it did before profiles (ADR 0094). */

const CY = { sub: 'child-cy', role: 'child', parentId: 'parent-1', name: 'Cy' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('the native shell keeps the doodle on the device key, names no player and never reloads', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  // Even a family cookie, which the shell's own origin never has, changes nothing.
  await setFamilyCookie(page, CY)
  await runAsNativeShell(page)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.drawStroke({ x: 30, y: 30 }, { x: 120, y: 120 })
  await expect.poll(() => storedStrokes(page, null)).toBe(1)
  expect(await readDoodle(page, CY.sub)).toBeNull()
  await root.verifyNoPlayerShown()

  let loads = 0
  page.on('load', () => loads++)
  await setFamilyCookie(page, BO)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  expect(loads).toBe(0)
  expect(await readDoodle(page, BO.sub)).toBeNull()
})

test('the native shell’s back arrow resolves as it did before profiles', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await runAsNativeShell(page)

  await mountApp()
  // The shell's own hostname is `localhost`, which the pre-estate rule sends to the local hub.
  const back = page.getByRole('link', { name: /back to home of ed/i })
  await expect(back).toHaveAttribute('href', 'http://localhost:3000')
})
