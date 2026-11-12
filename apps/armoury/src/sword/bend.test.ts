import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { centreLineAt as bladeCentreLine } from './blade.ts'
import { centreLineAt } from './bend.ts'
import { compileSword } from './compile.ts'
import { swordSchema } from './swordSchema.ts'

describe('centreLineAt', () => {
  it('is the blade mesh centre line, for every curved Kind and curve', () => {
    for (const family of ['sabre', 'katana'])
      for (const curve of [0, 0.35, 0.7, 1])
        for (const bladeLength of [0, 1]) {
          const spec = compileSword(normalise(swordSchema, { family, curve, bladeLength }))
          const { from, to } = spec.blade
          for (let i = -1; i <= 40; i++) {
            const z = from + ((to - from) * i) / 40
            const a = centreLineAt(spec, z)
            const b = bladeCentreLine(spec, z)
            for (const k of ['x', 'z', 'angle', 'curvature'] as const)
              expect(Math.abs(a[k] - b[k])).toBeLessThan(1e-9)
          }
        }
  })
})
