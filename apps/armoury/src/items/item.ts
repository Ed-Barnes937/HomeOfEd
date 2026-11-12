import type { ItemSchema, Params, ParamValue } from '../engine/schema.ts'

/** Every kind, in the order a share link is read: the first one it names wins. */
export const ITEM_KINDS = ['wand', 'sword'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

/** As stored and shared. `name` only once a child renames it. */
export interface StoredItem {
  params: Params
  name?: string
}

export interface ItemDef {
  kind: ItemKind
  schema: ItemSchema
  /** localStorage key of this kind's save document. */
  storageKey: string
  firstVisit(): Params
  /** Groups every Try another keeps (the "kind" picker). */
  keeps: readonly string[]
  /** Extra params a `set` brings with it (a wand made a Branch starts with bark). */
  follows?(before: Params, key: string, value: ParamValue): Params | undefined
  name(p: Params): string
  number(p: Params): string
  tagLine(p: Params): string
  lore(p: Params): string
  /** The short line on a shelf label. */
  shelfLine(p: Params): string
  /** The colour of its light as #rrggbb: the wand's core, the sword's runes or forge ember. */
  glow(p: Params): string
  /** Its drawn length over the stage's fill, for the shadow, the glow and the picture. */
  lengthFraction(p: Params): number
}
