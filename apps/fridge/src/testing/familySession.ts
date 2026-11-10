// Node side of the family-session seams fridge's suites use (ADR 0094). fridge
// does not sync, so a player is just the cookie hub writes when one is picked.
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

/** Every localStorage entry, for "wrote nothing" comparisons. */
export async function readAllLocalStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)!
      entries[key] = window.localStorage.getItem(key)!
    }
    return entries
  })
}

/** Every sessionStorage entry: `/b` must leave it as it found it while the visitor plays. */
export async function readAllSessionStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)!
      entries[key] = window.sessionStorage.getItem(key)!
    }
    return entries
  })
}

export async function readLocalItem(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key)
}

export async function writeLocalItem(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(({ k, v }) => window.localStorage.setItem(k, v), { k: key, v: value })
}

/** The names of the saved fridges in a stored `fridge:v1` document. */
export function savedNames(raw: string | null): string[] {
  if (raw === null) return []
  return (JSON.parse(raw) as { saved: { name: string }[] }).saved.map((b) => b.name)
}

export async function readSessionItem(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.sessionStorage.getItem(k), key)
}

export async function writeSessionItem(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(({ k, v }) => window.sessionStorage.setItem(k, v), { k: key, v: value })
}
