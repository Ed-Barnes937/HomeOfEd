// Re-minting an expired family token without a screen (ADR 0095, ticket 06).
import { type FamilyIdentityContract, readFamilySession, writeFamilySession } from '@hoe/accounts'
import type { QueryClient } from '@tanstack/react-query'

import { familyQueryKeys } from './accountQueries.ts'
import { familySessionCookieOptions } from './familyService.ts'
import { arrivalReturnTo, returnToApp } from './returnTo.ts'

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const REMEMBERED_PROFILE_KEY = 'hub.rememberedProfile'
export const SILENT_RENEWAL_KEY = 'hub.silentRenewal'
export const SILENT_RENEWAL_WINDOW_MS = 60_000
export const SILENT_RENEWAL_TIME_BOX_MS = 2_000
const HAND_OFF_STALE_MS = 10_000

/** The account id last picked on this device: the parent's or a child profile's. */
export function rememberedProfile(storage: KeyValueStorage = localStorage): string | null {
  return attempt(() => storage.getItem(REMEMBERED_PROFILE_KEY), null)
}

export function rememberProfile(accountId: string, storage: KeyValueStorage = localStorage): void {
  attempt(() => storage.setItem(REMEMBERED_PROFILE_KEY, accountId), undefined)
}

/** Forgets the remembered profile; given an id, only when that is the one remembered. */
export function forgetProfile(accountId?: string, storage: KeyValueStorage = localStorage): void {
  if (accountId !== undefined && rememberedProfile(storage) !== accountId) return
  attempt(() => storage.removeItem(REMEMBERED_PROFILE_KEY), undefined)
}

/** False inside the window after a silent renewal for this `returnTo`, or with no storage to tell. */
export function silentRenewalAllowed(
  returnTo: string,
  now: number,
  storage: KeyValueStorage = sessionStorage,
): boolean {
  const records = attempt(() => readRenewals(storage), null)
  if (records === null) return false
  const at = records[returnTo]
  return at === undefined || now - at >= SILENT_RENEWAL_WINDOW_MS
}

/** False when the record could not be written, and so a loop could not be seen. */
export function recordSilentRenewal(
  returnTo: string,
  now: number,
  storage: KeyValueStorage = sessionStorage,
): boolean {
  return attempt(() => {
    const kept = Object.entries(readRenewals(storage)).filter(
      ([, at]) => now - at < SILENT_RENEWAL_WINDOW_MS,
    )
    storage.setItem(
      SILENT_RENEWAL_KEY,
      JSON.stringify(Object.fromEntries([...kept, [returnTo, now]])),
    )
    return true
  }, false)
}

/**
 * Whether this arrival is worth a silent renewal at all, read synchronously so
 * the page can render nothing while it is tried: a vetted `returnTo`, no family
 * token, and a profile remembered on this device.
 */
export function silentRenewalWorthTrying(): boolean {
  return arrivalReturnTo() !== null && readFamilySession() === null && rememberedProfile() !== null
}

let attempted: Promise<boolean> | null = null

/**
 * Tried once per document, with one call each and no retries, inside a time box.
 * True once the visitor is on their way back; false means show the page.
 */
export function renewSilently(
  client: FamilyIdentityContract,
  queryClient: QueryClient,
): Promise<boolean> {
  if (attempted !== null) return attempted
  const box = { over: false }
  const timedOut = new Promise<boolean>((resolve) =>
    setTimeout(() => {
      box.over = true
      resolve(false)
    }, SILENT_RENEWAL_TIME_BOX_MS),
  )
  attempted = Promise.race([tryRenewal(client, queryClient, box).catch(() => false), timedOut])
  return attempted
}

// Answers renewal fetched and handed to the page it falls through to.
const handedOff = new WeakSet<object>()

/** The `staleTime` for the page's own family queries: fresh briefly if handed off. */
export function handOffStaleTime(query: { state: { data?: unknown } }): number {
  const data = query.state.data
  return typeof data === 'object' && data !== null && handedOff.has(data) ? HAND_OFF_STALE_MS : 0
}

function handOff<T extends object>(
  queryClient: QueryClient,
  queryKey: readonly string[],
  data: T,
): T {
  handedOff.add(data)
  queryClient.setQueryData(queryKey, data)
  return data
}

async function tryRenewal(
  client: FamilyIdentityContract,
  queryClient: QueryClient,
  box: { over: boolean },
): Promise<boolean> {
  const returnTo = arrivalReturnTo()
  const remembered = rememberedProfile()
  if (returnTo === null || remembered === null || readFamilySession() !== null) return false
  if (!silentRenewalAllowed(returnTo, Date.now())) return false

  const { parent } = handOff(queryClient, familyQueryKeys.me, await client.me())
  if (box.over || parent === null) return false
  if (remembered !== parent.id) {
    const profiles = handOff(queryClient, familyQueryKeys.children, await client.listChildren())
    if (box.over || !profiles.some((profile) => profile.id === remembered)) return false
  }

  if (!recordSilentRenewal(returnTo, Date.now())) return false
  const { token } = await client.mintSessionToken(
    remembered === parent.id ? {} : { childId: remembered },
  )
  if (box.over) return false
  const written = writeFamilySession(token, familySessionCookieOptions(window.location.hostname))
  return returnToApp(written)
}

function readRenewals(storage: KeyValueStorage): Record<string, number> {
  const raw = storage.getItem(SILENT_RENEWAL_KEY)
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    )
  } catch {
    return {}
  }
}

// Storage can throw outright (blocked site data, some private modes).
function attempt<T>(run: () => T, fallback: T): T {
  try {
    return run()
  } catch {
    return fallback
  }
}
