import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { inwardNormals, openEdges } from '../sword/sweep.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion } from './compile.ts'
import { buildPotionMesh } from './geometry.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]

describe('the glass at every neck', () => {
  it.each(SHAPES)('%s: closed and outward at every 0.025 of neck', (shape) => {
    for (let k = 0; k <= 40; k++) {
      const neck = k / 40
      const values = { ...withPours([]), shape, neck, stopper: 'cork', label: 'none' }
      const glass = buildPotionMesh(compilePotion(normalise(potionSchema, values))).glass
      expect(openEdges(glass), `${shape} neck ${neck} open edges`).toBe(0)
      expect(inwardNormals(glass), `${shape} neck ${neck} inward normals`).toBe(0)
    }
  })
})
