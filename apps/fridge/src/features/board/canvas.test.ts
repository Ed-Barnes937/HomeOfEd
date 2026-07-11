import { describe, expect, it } from 'vitest'

import { CANVAS_W, clampPan, computeFitScale, DOOR_W, toLogical } from './canvas.ts'

describe('cross-device board consistency', () => {
  // The regression today's bug reproduces: positions were bound to a *measured*
  // surface that differs per device. Bound to the constant canvas + read back
  // through the render scale, a magnet resolves to the SAME logical coords on
  // any stage size — no drift, no clamp.
  it('renders a stored magnet at the same logical position on very different stages', () => {
    const magnet = { x: 1000, y: 650 } // near the canvas corner; fits in 1080×720
    const big = computeFitScale(2000, 1400)
    const small = computeFitScale(380, 260)
    expect(big).toBeGreaterThan(small) // the two stages scale very differently

    for (const scale of [big, small]) {
      const rect = { left: 0, top: 0, width: CANVAS_W * scale }
      // A pointer over the magnet's rendered centre maps back to the SAME logical
      // coords regardless of how large the stage (and thus the scale) is.
      const logical = toLogical(rect, magnet.x * scale, magnet.y * scale)
      expect(logical.x).toBeCloseTo(magnet.x)
      expect(logical.y).toBeCloseTo(magnet.y)
    }
  })
})

describe('pointer under scale', () => {
  it('moves the magnet by N/scale logical px for an N-client-px drag', () => {
    const scale = 0.5
    const rect = { left: 100, top: 50, width: CANVAS_W * scale }
    const before = toLogical(rect, 300, 200)
    const after = toLogical(rect, 340, 200) // +40 client px
    expect(after.x - before.x).toBeCloseTo(40 / scale) // 80 logical px
  })

  it('still tracks 1:1 in logical px while zoomed (zoom folds into the rect width)', () => {
    const fit = 0.5
    const zoom = 2
    const rect = { left: 0, top: 0, width: CANVAS_W * fit * zoom }
    const before = toLogical(rect, 0, 0)
    const after = toLogical(rect, 30, 0) // +30 client px
    expect(after.x - before.x).toBeCloseTo(30 / (fit * zoom))
  })
})

describe('clampPan', () => {
  it('pins the pan to 0 in the fit view (the door fits, no room to pan)', () => {
    const scale = computeFitScale(1400, 900)
    expect(clampPan({ x: 50, y: 50 }, scale, 1400, 900)).toEqual({ x: 0, y: 0 })
  })

  it('allows pan within the overflow once zoomed in', () => {
    const clamped = clampPan({ x: 9999, y: 0 }, 2, DOOR_W, 400)
    expect(clamped.x).toBeGreaterThan(0)
    expect(clamped.x).toBeLessThan(9999)
  })
})
