// Node side of the family-profile harness (ADR 0094): the player's cookie, the
// legacy doodle, and each profile's doodle on disk.
import { FAMILY_SESSION_COOKIE, profileScopedKey } from '@hoe/accounts'
import { mintTestToken, type FakeSessionInput } from '@hoe/accounts/testing'
import type { Page } from '@playwright/test'

import type { Op } from '../features/doodle/engine/types.ts'
import { SESSION_KEY } from '../features/doodle/session.ts'
import { NATIVE_SHELL_KEY } from './nativeShell.ts'

/** The family cookie as hub writes it when `session` is picked, in this tab or another. */
export async function setFamilyCookie(page: Page, session: FakeSessionInput): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      document.cookie = `${name}=${value}; path=/`
    },
    { name: FAMILY_SESSION_COOKIE, value: mintTestToken(session) },
  )
}

/** Mount the next app as the Capacitor shell would run it. Call after the last reload, before `mountApp`. */
export async function runAsNativeShell(page: Page): Promise<void> {
  await page.evaluate((key) => {
    ;(globalThis as unknown as Record<string, unknown>)[key] = true
  }, NATIVE_SHELL_KEY)
}

/** A drawing with one stroke, as a device held it before profiles existed. */
export const LEGACY_DOODLE: readonly Op[] = [
  {
    type: 'field',
    viewBox: { width: 800, height: 500 },
    blots: [{ cx: 200, cy: 200, r: 60, points: [], satellites: [] }],
  },
  {
    type: 'stroke',
    stroke: {
      color: '#2b2b2b',
      width: 3.4,
      points: [
        { x: 180, y: 260 },
        { x: 160, y: 320 },
      ],
    },
  },
]

/** Write `raw` under the unscoped key, as espy did before profiles. */
export async function seedLegacyDoodle(page: Page, raw: string): Promise<void> {
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key: SESSION_KEY,
    value: raw,
  })
}

/** The raw doodle on disk for `accountId`, or the unscoped device copy for `null`. */
export async function readDoodle(page: Page, accountId: string | null): Promise<string | null> {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    profileScopedKey(SESSION_KEY, accountId),
  )
}

/** How many strokes the doodle on disk for `accountId` holds; 0 when there is none. */
export async function storedStrokes(page: Page, accountId: string | null): Promise<number> {
  const raw = await readDoodle(page, accountId)
  return raw === null ? 0 : (JSON.parse(raw) as Op[]).filter((op) => op.type === 'stroke').length
}
