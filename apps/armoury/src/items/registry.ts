import { swordItem } from '../sword/item.ts'
import { wandItem } from '../wand/item.ts'
import type { ItemDef, ItemKind } from './item.ts'

export const ITEMS: Record<ItemKind, ItemDef> = { wand: wandItem, sword: swordItem }
