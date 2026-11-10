// Node side: arrange who is playing the way /account's picker would, before or
// after the app mounts (boop's seedFamily precedent).
import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken } from '@hoe/accounts/testing'
import type { Page } from '@playwright/test'

/** Host-scoped here, as on localhost. Needs the page to have its origin already. */
export async function playAs(page: Page, name: string): Promise<void> {
  const token = mintTestToken({ sub: 'child-robin', role: 'child', parentId: 'parent-1', name })
  await page.evaluate(
    ({ cookie, value }) => {
      document.cookie = `${cookie}=${value}; path=/`
    },
    { cookie: FAMILY_SESSION_COOKIE, value: token },
  )
}
