import { ITEM_KINDS, type ItemDef, type ItemKind, type StoredItem } from '../items/item.ts'
import { ITEMS } from '../items/registry.ts'
import { SHOP_PATHS } from '../landing.ts'
import { decodeStored } from '../persistence/saveFormat.ts'

/** The link's own version, separate from the save format's: links live forever (ADR 0075). */
export const SHARE_FORMAT_VERSION = 1

export const SHARE_HASH_PREFIX = '#w='

export interface SharedItem {
  kind: ItemKind
  item: StoredItem
}

type Items = Partial<Record<ItemKind, ItemDef>>

/** The kind is the name of the field that holds the item, so a wand link is as it always was. */
export function encodeShare(kind: ItemKind, item: StoredItem): string {
  return toBase64Url(JSON.stringify({ version: SHARE_FORMAT_VERSION, [kind]: item }))
}

/** Total: anything that isn't a current-version item of a kind this build has reads as `null`. */
export function decodeShare(token: string, items: Items = ITEMS): SharedItem | null {
  const json = fromBase64Url(token)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const payload = parsed as Record<string, unknown>
  if (payload.version !== SHARE_FORMAT_VERSION) return null
  for (const kind of ITEM_KINDS) {
    const def = items[kind]
    const item = def ? decodeStored(def.schema, payload[kind]) : null
    if (item) return { kind, item }
  }
  return null
}

/** The view a share link opens: ungated, and it writes nothing (ADR 0093 decision 6). */
export const SHARED_PATH = '/shared'

/** Always `/shared`, whichever page built it: the link itself names the kind. */
export function buildShareUrl(origin: string, kind: ItemKind, item: StoredItem): string {
  return `${origin}${SHARED_PATH}${SHARE_HASH_PREFIX}${encodeShare(kind, item)}`
}

/** "Keep this" on `/shared`: the kind's own shop with `fragment`, where the gate asks who is playing. */
export function keepSharedUrl(origin: string, kind: ItemKind, fragment: string): string {
  return `${origin}${SHOP_PATHS[kind]}${fragment}`
}

/** The item as it is now; unchanged since `/shared` opened, the arrival fragment byte for byte, or none
 *  when the link held no item (the shop then opens the player's own counter). */
export function keepFragment(arrival: string, opened: string, current: string): string {
  if (current !== opened) return `${SHARE_HASH_PREFIX}${current}`
  return decodeShareHash(arrival) === null ? '' : arrival
}

export function decodeShareHash(hash: string, items: Items = ITEMS): SharedItem | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length), items)
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
