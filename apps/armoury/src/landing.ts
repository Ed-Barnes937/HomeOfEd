import type { ItemKind } from './items/item.ts'

export type ShopPath = '/wands' | '/swords'

export const SHOP_PATHS: Record<ItemKind, ShopPath> = { wand: '/wands', sword: '/swords' }

export interface Landing {
  /** The kind a share link brought, if the visit began with one. */
  arrivalKind: ItemKind | null
  lastShop: ItemKind | null
}

/** Where a page load at the root goes: a link's own shop, else the last shop, else the street. */
export function landingPath({ arrivalKind, lastShop }: Landing): ShopPath | '/street' {
  const kind = arrivalKind ?? lastShop
  return kind ? SHOP_PATHS[kind] : '/street'
}
