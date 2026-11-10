// Node side of the profile harness (ADR 0094): the family cookie karesansui reads
// its player from, and the preset documents on disk per profile.
import { FAMILY_SESSION_COOKIE, profileScopedKey } from '@hoe/accounts'
import { mintTestToken, type FakeSessionInput } from '@hoe/accounts/testing'
import type { Page } from '@playwright/test'

export const PRESETS_V2 = 'karesansui:presets:v2'
export const PRESETS_V1 = 'karesansui:presets:v1'

/** The family cookie as hub writes it when `session` is picked, in this tab or another. */
export async function setFamilyCookie(page: Page, session: FakeSessionInput): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      document.cookie = `${name}=${value}; path=/`
    },
    { name: FAMILY_SESSION_COOKIE, value: mintTestToken(session) },
  )
}

/** A preset document the device held before profiles, under its unscoped key. */
export async function seedDevicePresets(page: Page, key: string, presets: unknown[]): Promise<void> {
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key,
    value: JSON.stringify(presets),
  })
}

/** The raw preset document on disk for `accountId`, or the unscoped one for `null`. */
export async function readPresets(
  page: Page,
  key: string,
  accountId: string | null,
): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), profileScopedKey(key, accountId))
}

/** The preset names on disk for `accountId`, or `[]` when there is no document. */
export async function presetNames(page: Page, accountId: string | null): Promise<string[]> {
  const raw = await readPresets(page, PRESETS_V2, accountId)
  return raw ? (JSON.parse(raw) as { name: string }[]).map((preset) => preset.name) : []
}
