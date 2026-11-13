import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { PROFILE_KEYS } from '../persistence/profileKeys.ts'
import { POTION_SAVE_KEY, SAVE_KEY, SWORD_SAVE_KEY } from '../persistence/storage.ts'
import { potionItem } from '../potion/item.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { decodeShare, encodeShare } from '../share/shareLink.ts'
import { swordItem } from '../sword/item.ts'
import { wandItem } from '../wand/item.ts'
import { ITEM_KINDS } from './item.ts'
import { ITEMS } from './registry.ts'

const token = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url')

describe('the item registry', () => {
  it('holds each kind under its own name', () => {
    expect(ITEMS.wand).toBe(wandItem)
    for (const [kind, def] of Object.entries(ITEMS)) expect(def.kind).toBe(kind)
  })

  it('lists wands first and new kinds last, the order a share link is read in', () => {
    expect(ITEM_KINDS).toEqual(['wand', 'sword', 'potion'])
  })

  it('gives every kind its own save key', () => {
    const keys = Object.values(ITEMS).map((def) => def.storageKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("keeps every kind's save under the player, never the device", () => {
    for (const kind of ITEM_KINDS) expect(PROFILE_KEYS.keys).toContain(ITEMS[kind].storageKey)
  })

  it('holds the potion as the third kind', () => {
    expect(ITEMS.potion).toBe(potionItem)
  })

  it('keeps each of the three kinds under its own key', () => {
    expect(POTION_SAVE_KEY).toBe('armoury:save:potion')
    expect(ITEM_KINDS.map((kind) => ITEMS[kind].storageKey)).toEqual([
      SAVE_KEY,
      SWORD_SAVE_KEY,
      POTION_SAVE_KEY,
    ])
  })

  describe('a potion link', () => {
    const potion = { params: normalise(potionSchema, { shape: 'gourd' }), name: 'Fizz' }

    it('names its kind by the potion field', () => {
      expect(decodeShare(encodeShare('potion', potion))).toEqual({ kind: 'potion', item: potion })
    })

    it('loses to a wand or a sword in the same link', () => {
      const both = token({ version: 1, potion, sword: { params: swordItem.firstVisit() } })
      expect(decodeShare(both)?.kind).toBe('sword')
    })

    it('loses to a wand in the same link', () => {
      const both = token({ version: 1, potion, wand: { params: wandItem.firstVisit() } })
      expect(decodeShare(both)?.kind).toBe('wand')
    })

    it('reads as no item at all to a build without potions', () => {
      const olderBuild = { wand: wandItem, sword: swordItem }
      expect(decodeShare(encodeShare('potion', potion), olderBuild)).toBeNull()
    })
  })
})
