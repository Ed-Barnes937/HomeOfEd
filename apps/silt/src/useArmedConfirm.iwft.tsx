import { expect } from '@playwright/experimental-ct-react'

import { ArmedConfirmProbe } from './testing/ArmedConfirmProbe.tsx'
import { test } from './testing/iwftTest.tsx'

test('re-arming resets the auto-disarm window instead of leaking the previous timer', async ({
  mount,
  page,
}) => {
  const component = await mount(<ArmedConfirmProbe ms={300} />)

  await component.getByTestId('arm-a').click()
  await expect(component.getByTestId('armed')).toHaveText('a')

  // Still within the first arm's 300ms window.
  await page.waitForTimeout(200)
  await component.getByTestId('arm-b').click()
  await expect(component.getByTestId('armed')).toHaveText('b')

  // 400ms after arm-a: a leaked first timer would have fired here and
  // disarmed early, even though arm-b only re-armed 200ms ago.
  await page.waitForTimeout(200)
  await expect(component.getByTestId('armed')).toHaveText('b')

  // Past 300ms since arm-b: it auto-disarms on its own schedule.
  await page.waitForTimeout(150)
  await expect(component.getByTestId('armed')).toHaveText('none')
})

test('disarm clears immediately and cancels the pending auto-disarm', async ({ mount, page }) => {
  const component = await mount(<ArmedConfirmProbe ms={300} />)

  await component.getByTestId('arm-a').click()
  await expect(component.getByTestId('armed')).toHaveText('a')

  await component.getByTestId('disarm').click()
  await expect(component.getByTestId('armed')).toHaveText('none')

  // No stray disarm-after-the-fact re-triggering from the cancelled timer.
  await page.waitForTimeout(350)
  await expect(component.getByTestId('armed')).toHaveText('none')
})
