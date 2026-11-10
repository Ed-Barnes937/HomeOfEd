// Node side of the family-account harness (ADR 0080): the cookie boop reads its
// session from, the state the in-page fake service starts with, and a read of
// what ended up on the account.
import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, type FakeSessionInput } from '@hoe/accounts/testing'
import type { Page } from '@playwright/test'

import { SAVE_KEY } from '../persistence/storage.ts'
import { BOOP_APP_ID } from '../sync/boopSync.ts'
import { FAMILY_SEED_KEY, type FamilySeed } from './familySeed.ts'
import { BOOP_SAVE_CALLS_KEY, BOOP_SAVE_CLIENT_KEY } from './gridProtocol.ts'

export interface FamilySeedOpts extends FamilySeed {
  /**
   * Whether boop gets a session cookie of its own. `false` leaves a reachable,
   * signed-in service that boop has no session for - which is how a test shows
   * boop never calls it.
   */
  cookie?: boolean
}

/**
 * Seed the page before the app under test mounts. Call it after the usual
 * reload, like every other seed in boop's suites: it writes to localStorage, so
 * the page needs an origin, and the app must not have mounted yet.
 */
export async function seedFamily(page: Page, opts: FamilySeedOpts): Promise<void> {
  const { cookie = true, ...seed } = opts
  if (cookie && seed.session) await setFamilyCookie(page, seed.session)
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: FAMILY_SEED_KEY, value: JSON.stringify(seed) },
  )
}

/** The family cookie as hub writes it when `session` is picked, in this tab or another. */
export async function setFamilyCookie(page: Page, session: FakeSessionInput): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      document.cookie = `${name}=${value}; path=/`
    },
    { name: FAMILY_SESSION_COOKIE, value: mintTestToken(session) },
  )
}

/** What is on the account now - read after the app has mounted. */
export async function readRemoteSave(page: Page): Promise<string | null> {
  return page.evaluate(
    async ({ key, appId, slotKey }) => {
      const client = (globalThis as Record<string, unknown>)[key] as {
        get: (input: {
          appId: string
          slotKey: string
        }) => Promise<{ blob: string; version: number } | null>
      }
      return (await client.get({ appId, slotKey }))?.blob ?? null
    },
    { key: BOOP_SAVE_CLIENT_KEY, appId: BOOP_APP_ID, slotKey: SAVE_KEY },
  )
}

/** The calls the app made on the family service, in order. */
export async function readFamilyCalls(page: Page): Promise<readonly string[]> {
  return page.evaluate(
    (key) => (globalThis as Record<string, unknown>)[key] as string[],
    BOOP_SAVE_CALLS_KEY,
  )
}
