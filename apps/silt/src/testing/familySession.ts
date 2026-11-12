// Node side of the family-session harness: the cookie silt reads its player
// from, and what ended up in storage for each player.
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

/** Every `silt:` key in localStorage, by its stored name. */
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

/**
 * The scene names IndexedDB holds for a player (`null` for the device), in
 * list order. It never creates the database: an app that has not opened it yet
 * reads as no scenes.
 */
export async function sceneNames(page: Page, accountId: string | null): Promise<string[]> {
  return page.evaluate(
    (namespace) =>
      new Promise<string[]>((resolve, reject) => {
        const open = window.indexedDB.open('silt')
        open.onupgradeneeded = () => {
          open.transaction?.abort()
          resolve([])
        }
        open.onerror = () => {
          if (open.error?.name !== 'AbortError') reject(open.error ?? new Error('open failed'))
        }
        open.onsuccess = () => {
          const db = open.result
          const read = db
            .transaction('rows')
            .objectStore('rows')
            .index('byNamespace')
            .getAll(namespace)
          read.onsuccess = () => {
            db.close()
            const rows = read.result as { name: string; order: number }[]
            resolve(rows.sort((a, b) => a.order - b.order).map((row) => row.name))
          }
        }
      }),
    accountId ?? '',
  )
}
