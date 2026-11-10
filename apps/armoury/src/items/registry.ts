import { wandItem } from '../wand/item.ts'
import type { ItemDef } from './item.ts'

export const ITEMS: { wand: ItemDef; sword?: ItemDef } = { wand: wandItem }
