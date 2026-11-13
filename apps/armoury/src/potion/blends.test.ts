import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { SECRET_BLENDS, secretBlend } from './blends.ts'
import { isForbiddenName } from './doNotUse.ts'
import type { IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { pourList, withPours } from './pours.ts'

const potion = (...pours: IngredientId[]) => normalise(potionSchema, { ...withPours(pours) })
const sentences = (text: string) => text.split(/[.!?]/).filter((s) => s.trim() !== '')

describe('SECRET_BLENDS', () => {
  it('has at most twelve blends', () => {
    expect(SECRET_BLENDS.length).toBeGreaterThan(0)
    expect(SECRET_BLENDS.length).toBeLessThanOrEqual(12)
  })

  it('has unique ids, names and pour lists', () => {
    expect(new Set(SECRET_BLENDS.map((b) => b.id)).size).toBe(SECRET_BLENDS.length)
    expect(new Set(SECRET_BLENDS.map((b) => b.name)).size).toBe(SECRET_BLENDS.length)
    expect(new Set(SECRET_BLENDS.map((b) => b.pours.join())).size).toBe(SECRET_BLENDS.length)
  })

  it('is reachable: every blend normalises unchanged and is found by secretBlend', () => {
    for (const blend of SECRET_BLENDS) {
      const p = potion(...blend.pours)
      expect(pourList(p)).toEqual(blend.pours)
      expect(secretBlend(p)).toBe(blend)
    }
  })

  it('has two-sentence lore, with no forbidden words', () => {
    for (const blend of SECRET_BLENDS) {
      expect(sentences(blend.lore)).toHaveLength(2)
      expect(isForbiddenName(blend.name)).toBe(false)
      for (const s of sentences(blend.lore)) expect(isForbiddenName(s)).toBe(false)
    }
  })

  it('names four Bog murks Bottom of the Pond', () => {
    expect(secretBlend(potion('bogmurk', 'bogmurk', 'bogmurk', 'bogmurk'))?.name).toBe(
      'Bottom of the Pond',
    )
  })
})

describe('secretBlend', () => {
  it('matches the whole pour list only', () => {
    const blend = SECRET_BLENDS.find((b) => b.pours.length === 4)!
    expect(secretBlend(potion(...blend.pours.slice(0, 3)))).toBeNull()
    expect(secretBlend(potion('moonmilk', 'bluebell', 'moonmilk', 'rosehip'))).toBeNull()
    expect(secretBlend(potion('rosehip', 'moonmilk', 'bluebell', 'moonmilk'))).toBeNull()
  })

  it('is null for an empty bottle and an ordinary potion', () => {
    expect(secretBlend(potion())).toBeNull()
    expect(secretBlend(potion('moonmilk', 'rosehip', 'starpetal'))).toBeNull()
  })

  it('cares about order', () => {
    expect(secretBlend(potion('moonmilk', 'thundercloud'))).toBeNull()
    expect(secretBlend(potion('thundercloud', 'moonmilk'))?.name).toBe('The Moon Behind the Storm')
  })
})
