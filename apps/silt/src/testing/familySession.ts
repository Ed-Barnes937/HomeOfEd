// Node side of the family-session harness: the cookie silt reads its player
// from, and what ended up in localStorage under each name.
import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, type FakeSessionInput } from '@hoe/accounts/testing'
import type { Page } from '@playwright/test'

/** The family cookie as hub writes it when `session` is picked, in this tab or another. */
export async function setFamilyCookie(page: Page, session: FakeSessionInput): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      document.cookie = `${name}=${value}; path=/`
    },
    { name: FAMILY_SESSION_COOKIE, value: mintTestToken(session) },
  )
}

/** Every `silt:` key on the device, by its stored name. */
export async function readSiltKeys(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith('silt:')) out[key] = window.localStorage.getItem(key) ?? ''
    }
    return out
  })
}

/** The scene names in one profile's index (`null` for the device's legacy one). */
export async function sceneNames(page: Page, accountId: string | null): Promise<string[] | null> {
  const key = accountId === null ? 'silt:scenes' : `silt:scenes@${accountId}`
  const raw = await page.evaluate((k) => window.localStorage.getItem(k), key)
  return raw === null ? null : (JSON.parse(raw) as { name: string }[]).map((row) => row.name)
}
