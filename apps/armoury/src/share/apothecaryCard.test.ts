import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { liftFromGround, recipeTag } from './apothecaryCard.ts'

const GROUND: [number, number, number] = [26, 17, 20]
const pixels = (...px: number[][]) => new Uint8ClampedArray(px.flat())

describe('liftFromGround', () => {
  it('makes the ground clear and keeps the bottle opaque', () => {
    const data = pixels([26, 17, 20, 255], [200, 40, 90, 255])
    liftFromGround(data, GROUND)
    expect(data[3]).toBe(0)
    expect([...data.slice(4)]).toEqual([200, 40, 90, 255])
  })

  it('keeps a faint reflection as light added to whatever it is drawn over', () => {
    const data = pixels([36, 27, 30, 255])
    liftFromGround(data, GROUND)
    const alpha = data[3]! / 255
    expect(alpha).toBeGreaterThan(0)
    expect(alpha).toBeLessThan(0.5)
    // Drawn back over the ground it came from, it is the pixel it was.
    for (let c = 0; c < 3; c++)
      expect(Math.abs(alpha * data[c]! + (1 - alpha) * GROUND[c]! - [36, 27, 30][c]!)).toBeLessThan(
        1.5,
      )
  })

  it('leaves a capture that already has a clear background as it is', () => {
    const data = pixels([0, 0, 0, 0], [26, 17, 20, 255], [120, 120, 120, 255])
    const before = [...data]
    liftFromGround(data, GROUND)
    expect([...data]).toEqual(before)
  })
})

describe('recipeTag', () => {
  const potion = (pour1: string, pour2: string) =>
    normalise(potionSchema, { pour1, pour2, pour3: 'none', pour4: 'none' })

  it('is cream paper for a potion and gilt for a secret blend', () => {
    const plain = recipeTag(potion('moonmilk', 'frogfizz'))
    const gold = recipeTag(potion('thundercloud', 'moonmilk'))
    expect(plain.edge).toBeUndefined()
    expect(gold.edge).toBeDefined()
    expect(gold.name).not.toBe(plain.name)
  })
})
