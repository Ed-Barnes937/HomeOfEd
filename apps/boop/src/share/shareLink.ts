/**
 * Share links: the whole boop encoded in the URL fragment, no server and no
 * account ([ADR 0026](../../../../docs/adr/0026-boop-share-links.md)).
 *
 * The payload is the save format's `StoredBoop` — one encoding for saving
 * and sharing, so new instruments, new kits and V2 pattern chaining extend both
 * at once. Decode is total, exactly as `parseSaveDocument` is: a mangled or
 * future-versioned link yields `null`, which the app treats as "no shared
 * boop" and opens an empty grid. A child never meets an error screen.
 */

import { decodeStoredBoop, type StoredBoop } from '../persistence/saveFormat.ts'

/**
 * The version of the *link*, deliberately its own number rather than the save
 * format's: links are out in the world for good, so a save-format bump must not
 * invalidate every link ever sent. Bump this only for a change no V1 decoder
 * could read, and keep the old decoder alongside the new one when you do.
 */
export const SHARE_FORMAT_VERSION = 1

/**
 * `#g=` — short, because the token follows it in every message a child sends.
 * Frozen (ticket 35, ADR 0026): the `g` predates this rename (it stood for
 * "groove") but every link already shared uses it, so it stays.
 */
export const SHARE_HASH_PREFIX = '#g='

interface SharePayload {
  version: number
  /**
   * Frozen key name (ticket 35): this is serialized verbatim into every
   * share link, so renaming it to `boop` would break every link already
   * sent, same as the save document's `creations` field.
   */
  creation: StoredBoop
}

/** Compact, URL-safe, and copy-pasteable without escaping. */
export function encodeShare(boop: StoredBoop): string {
  const payload: SharePayload = { version: SHARE_FORMAT_VERSION, creation: boop }
  return toBase64Url(JSON.stringify(payload))
}

/** Total: any token that is not a current-version boop reads as `null`. */
export function decodeShare(token: string | null | undefined): StoredBoop | null {
  if (token === null || token === undefined || token === '') return null

  const json = fromBase64Url(token)
  if (json === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const { version, creation } = parsed as Record<string, unknown>
  // V1 is the only scheme so far, so this is also the "future version" guard.
  // A V2 keeps this branch and adds its own beside it — old links keep working.
  if (version !== SHARE_FORMAT_VERSION) return null

  return decodeStoredBoop(creation) ?? null
}

/**
 * The link to hand to the share sheet or the clipboard. Any query string on the
 * sender's page is deliberately left off: the boop is the whole payload.
 */
export function buildShareUrl(
  location: Pick<Location, 'origin' | 'pathname'>,
  boop: StoredBoop,
): string {
  return `${location.origin}${location.pathname}${SHARE_HASH_PREFIX}${encodeShare(boop)}`
}

/** Read a shared boop out of `location.hash`; `null` if there isn't a valid one. */
export function decodeShareHash(hash: string): StoredBoop | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length))
}

/**
 * Drop the fragment once the boop is loaded, so a reload restores what the
 * child has since played with rather than re-opening the sender's version over
 * the top of it. `replaceState` keeps the back button pointing where it did.
 */
export function clearShareHash(
  location: Pick<Location, 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>,
): void {
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
