import { describe, expect, it } from 'vitest'

import { wandItem } from '../wand/item.ts'
import { ITEM_KINDS } from './item.ts'
import { ITEMS } from './registry.ts'

describe('the item registry', () => {
  it('holds each kind under its own name', () => {
    expect(ITEMS.wand).toBe(wandItem)
    for (const [kind, def] of Object.entries(ITEMS)) expect(def.kind).toBe(kind)
  })

  it('lists wands first, the order a share link is read in', () => {
    expect(ITEM_KINDS).toEqual(['wand', 'sword'])
  })

  it('gives every kind its own save key', () => {
    const keys = Object.values(ITEMS).map((def) => def.storageKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
