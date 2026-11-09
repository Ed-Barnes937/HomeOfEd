import { describe, expect, it } from 'vitest'

import { wandSchema } from '../wand/wandSchema.ts'
import { allowedOptions, defaults, normalise, randomise, seededRandom } from './schema.ts'

describe('normalise', () => {
  it('clamps numbers, snaps them to the step, and enforces allowed choices', () => {
    const p = normalise(wandSchema, {
      lengthCm: 99,
      thickness: 0.912,
      handleStyle: 'plain',
      handleCarving: 'diamonds',
      wood: 'walnut',
      stainColour: 'plum',
    })
    expect(p.lengthCm).toBe(38)
    expect(p.thickness).toBe(0.91)
    expect(p.handleCarving).toBe('none')
    expect(p.stainColour).toBe('none')
  })

  it('fills anything missing or mistyped with the default', () => {
    expect(normalise(wandSchema, { lengthCm: 'long', core: 'dragon' })).toEqual(
      defaults(wandSchema),
    )
  })
})

describe('randomise', () => {
  it('is deterministic for a seed', () => {
    expect(randomise(wandSchema, seededRandom(42))).toEqual(randomise(wandSchema, seededRandom(42)))
  })

  it('only ever produces normalised params', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = randomise(wandSchema, seededRandom(seed))
      expect(normalise(wandSchema, p)).toEqual(p)
    }
  })

  it('keeps the params of a locked group and rolls the rest', () => {
    const start = defaults(wandSchema)
    const rolled = randomise(wandSchema, seededRandom(7), {
      keep: start,
      locked: ['core', 'finish'],
    })
    expect(rolled.core).toBe(start.core)
    expect(rolled.wood).toBe(start.wood)
    expect(rolled.stainColour).toBe(start.stainColour)
    expect(rolled.lengthCm).not.toBe(start.lengthCm)
  })
})

describe('allowedOptions', () => {
  it('narrows a choice by the other params', () => {
    const stain = wandSchema.params.find((d) => d.key === 'stainColour')
    if (stain?.kind !== 'choice') throw new Error('stainColour is a choice')
    const onWalnut = allowedOptions(stain, normalise(wandSchema, { wood: 'walnut' }))
    expect(onWalnut.map((o) => o.value)).not.toContain('plum')
  })
})
