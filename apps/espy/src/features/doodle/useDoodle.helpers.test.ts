import { describe, expect, it } from 'vitest'

import { mulberry32 } from './engine/rng.ts'
import type { Op } from './engine/types.ts'
import { initialOps } from './useDoodle.helpers.ts'

describe('initialOps', () => {
  const css = { w: 800, h: 600 }

  it('generates a fresh field (with bloom) when nothing is restored', () => {
    const result = initialOps(null, css, mulberry32(1))
    expect(result.bloom).toBe(true)
    expect(result.ops).toHaveLength(1)
    const op = result.ops[0]!
    expect(op.type).toBe('field')
    if (op.type === 'field') {
      expect(op.viewBox).toEqual({ width: 800, height: 600 })
      expect(op.blots.length).toBeGreaterThan(0)
    }
  })

  it('restores a valid session field-first without bloom', () => {
    const loaded: Op[] = [
      { type: 'field', viewBox: { width: 400, height: 300 }, blots: [] },
      { type: 'eye', eye: { x: 10, y: 10, size: 12, pupilAngle: 0 } },
    ]
    const result = initialOps(loaded, css, mulberry32(1))
    expect(result.bloom).toBe(false)
    expect(result.ops).toBe(loaded)
  })

  it('generates when the restored ops do not start with a field', () => {
    const loaded: Op[] = [{ type: 'eye', eye: { x: 1, y: 1, size: 12, pupilAngle: 0 } }]
    const result = initialOps(loaded, css, mulberry32(1))
    expect(result.bloom).toBe(true)
    expect(result.ops[0]!.type).toBe('field')
  })

  it('generates on an empty restored array', () => {
    const result = initialOps([], css, mulberry32(1))
    expect(result.bloom).toBe(true)
    expect(result.ops[0]!.type).toBe('field')
  })
})
