import { decodeStoredWand, type StoredWand } from '../persistence/saveFormat.ts'

/** The link's own version, separate from the save format's: links live forever (ADR 0075). */
export const SHARE_FORMAT_VERSION = 1

export const SHARE_HASH_PREFIX = '#w='

export function encodeShare(wand: StoredWand): string {
  return toBase64Url(JSON.stringify({ version: SHARE_FORMAT_VERSION, wand }))
}

/** Total: anything that isn't a current-version wand reads as `null`. */
export function decodeShare(token: string): StoredWand | null {
  const json = fromBase64Url(token)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const { version, wand } = parsed as Record<string, unknown>
  if (version !== SHARE_FORMAT_VERSION) return null
  return decodeStoredWand(wand)
}

/** The view a share link opens: ungated, and it writes nothing (ADR 0093 decision 6). */
export const SHARED_PATH = '/shared'

export function buildShareUrl(origin: string, wand: StoredWand): string {
  return `${origin}${SHARED_PATH}${SHARE_HASH_PREFIX}${encodeShare(wand)}`
}

/** "Keep this wand" on `/shared`: the root with `fragment`, where the gate asks who is playing. */
export function keepSharedUrl(origin: string, fragment: string): string {
  return `${origin}/${fragment}`
}

/** The wand as it is now; unchanged since `/shared` opened, the arrival fragment byte for byte, or none
 *  when the link held no wand (the root then opens the player's own counter). */
export function keepFragment(arrival: string, opened: string, current: string): string {
  if (current !== opened) return `${SHARE_HASH_PREFIX}${current}`
  return decodeShareHash(arrival) === null ? '' : arrival
}

export function decodeShareHash(hash: string): StoredWand | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length))
}

/** Drops the fragment once loaded, so a reload shows the visitor's own edits. */
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
