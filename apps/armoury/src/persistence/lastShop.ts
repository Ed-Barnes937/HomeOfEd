import { ITEM_KINDS, type ItemKind } from '../items/item.ts'
import type { SaveStorage } from './storage.ts'

/** Holds the bare kind of the shop last visited; anything else reads as none. */
export const LAST_SHOP_KEY = 'armoury:shop'

export function readLastShop(storage: SaveStorage): ItemKind | null {
  try {
    const stored = storage.getItem(LAST_SHOP_KEY)
    return ITEM_KINDS.find((kind) => kind === stored) ?? null
  } catch {
    return null
  }
}

export function writeLastShop(storage: SaveStorage, kind: ItemKind): void {
  try {
    storage.setItem(LAST_SHOP_KEY, kind)
  } catch {
    // Quota or storage unavailable: drop the write rather than throw.
  }
}
