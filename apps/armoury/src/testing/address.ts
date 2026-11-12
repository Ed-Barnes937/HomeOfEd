import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { SAVE_KEY, SWORD_SAVE_KEY } from '../persistence/storage.ts'

/** The app is at this path with no fragment left in the address. */
export async function verifyAt(page: Page, path: string): Promise<void> {
  await expect
    .poll(() => {
      const { pathname, hash } = new URL(page.url())
      return pathname + hash
    })
    .toBe(path)
}

/** The address once the router's own pending history write has landed. */
async function settledAddress(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) =>
        setTimeout(() => resolve(window.location.pathname + window.location.hash)),
      ),
  )
}

/** Opens the app again at its root address, keeping any fragment; the test server serves only the root. */
export async function reloadAtRoot(page: Page): Promise<void> {
  await settledAddress(page)
  // The prototype's method, not the router's patched one, so the router does not follow the change.
  await page.evaluate(() =>
    History.prototype.replaceState.call(window.history, null, '', `/${window.location.hash}`),
  )
  await page.reload()
}

/** Reloads the page and puts the address back, so the next mount opens where this one was. */
export async function reloadInPlace(page: Page): Promise<void> {
  const address = await settledAddress(page)
  await reloadAtRoot(page)
  await page.evaluate((to) => window.history.replaceState(null, '', to), address)
}

/** Opening a link at `path` with nothing of one's own saved; the last shop is kept. */
export async function openAsNewVisitor(page: Page, url: string, path = '/'): Promise<void> {
  const { hash } = new URL(url)
  await reloadAtRoot(page)
  await page.evaluate(
    ({ keys, address }) => {
      for (const key of keys) window.localStorage.removeItem(key)
      window.history.replaceState(null, '', address)
    },
    { keys: [SAVE_KEY, SWORD_SAVE_KEY], address: path + hash },
  )
}
