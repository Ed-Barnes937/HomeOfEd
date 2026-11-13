import { profileInitial } from '@hoe/accounts'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator, Page } from '@playwright/test'

/** The player's avatar circle; CT runs outside the estate, so it names the player without linking to hub. */
export function playerCircle(page: Page, name: string): Locator {
  return page.getByRole('img', { name: `Playing as ${name}`, exact: true })
}

export async function verifyPlayer(page: Page, name: string): Promise<void> {
  await expect(playerCircle(page, name)).toHaveText(profileInitial(name))
  await expect(page.getByText(/playing as/i)).toHaveCount(0)
}

export async function verifyNoPlayer(page: Page): Promise<void> {
  await expect(page.getByRole('img', { name: /^Playing as / })).toHaveCount(0)
}
