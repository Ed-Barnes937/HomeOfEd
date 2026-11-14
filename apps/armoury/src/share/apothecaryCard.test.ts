import { describe, expect, it } from 'vitest'

import { FOOT } from '../apothecary/tableArt.ts'
import { normalise } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from '../potion/bottles.ts'
import { compilePotion } from '../potion/compile.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import { liftFromGround, pictureFraming, recipeTag } from './apothecaryCard.ts'
import { CARD_HEIGHT } from './shareCard.ts'

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
  const potion = (pours: string[], mixed: 'yes' | 'no') =>
    normalise(potionSchema, { pour1: pours[0], pour2: pours[1], pour3: pours[2], mixed })

  it('is cream paper for a potion and gilt for a mixed secret blend', () => {
    const plain = recipeTag(potion(['moonmilk', 'frogfizz', 'rosehip'], 'yes'))
    const gold = recipeTag(potion(['thundercloud', 'thundercloud', 'moonmilk'], 'yes'))
    expect(plain.edge).toBeUndefined()
    expect(gold.edge).toBeDefined()
    expect(gold.name).not.toBe(plain.name)
  })

  it('stays cream until the secret blend is mixed', () => {
    expect(
      recipeTag(potion(['thundercloud', 'thundercloud', 'moonmilk'], 'no')).edge,
    ).toBeUndefined()
  })
})

describe('pictureFraming', () => {
  // The wordmark is set at a 100 px baseline in 54 px type.
  const WORDMARK_BAND = 120
  const bottles = (Object.keys(BOTTLES) as ShapeId[]).flatMap((shape) =>
    [0, 0.4, 1].map((neck) => ({
      name: `${shape} neck ${neck}`,
      spec: compilePotion(
        normalise(potionSchema, {
          ...withPours(['moonmilk', 'rosehip']),
          shape,
          neck,
          stopper: 'glass',
        }),
      ),
    })),
  )

  it.each(bottles)(
    '$name: stands at least 40 percent of the picture tall, its top below the wordmark',
    ({ spec }) => {
      const { pxPerMm, foot } = pictureFraming(spec)
      expect(spec.heightMm * pxPerMm).toBeGreaterThanOrEqual(0.4 * CARD_HEIGHT)
      expect(foot.y - spec.heightMm * pxPerMm).toBeGreaterThan(WORDMARK_BAND)
    },
  )

  it.each(bottles)("$name: stands on the room's table line", ({ spec }) => {
    const { foot, toCard } = pictureFraming(spec)
    expect(toCard(FOOT.x, FOOT.y)).toEqual(foot)
  })
})
