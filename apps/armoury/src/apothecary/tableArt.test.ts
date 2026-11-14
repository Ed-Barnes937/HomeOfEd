import { afterEach, describe, expect, it, vi } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compilePotion } from '../potion/compile.ts'
import { BASE_LINE, HEADROOM } from '../potion/framing.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { BOARD_SLOT, bottleOnTable, FOOT, LOWER_SHELF_UNDERSIDE, roomSvg } from './tableArt.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const spec = (shape: string, neck = 0.5) =>
  compilePotion(normalise(potionSchema, { shape, neck, pour1: 'moonmilk', pour2: 'frogfizz' }))

const points = (d: string) =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])])

describe('the room', () => {
  it('is the same drawing every time', () => {
    const a = roomSvg(null, { flame: false })
    expect(roomSvg(null, { flame: false })).toBe(a)
    expect(a).not.toMatch(/NaN|undefined/)
    expect(roomSvg(null, { flame: true })).not.toBe(a)
  })

  it("leaves 40 units of dark wall between the tallest bottle's stopper and the shelf above it", () => {
    const tallestTop = FOOT.y - BOARD_SLOT * (BASE_LINE - HEADROOM)
    expect(tallestTop - LOWER_SHELF_UNDERSIDE).toBeGreaterThanOrEqual(40)
  })

  it("is not built when the shop's modules load, and is built once on its first visit", async () => {
    vi.stubGlobal('Image', class {})
    vi.resetModules()
    const encode = vi.spyOn(globalThis, 'encodeURIComponent')
    await import('./apothecary.ts')
    expect(encode).not.toHaveBeenCalled()

    const { roomImage } = await import('./tableArt.ts')
    const { apothecaryCardArt } = await import('../share/apothecaryCard.ts')
    expect(roomImage()).toBe(roomImage())
    expect(apothecaryCardArt()).toBe(apothecaryCardArt())
    expect(encode).toHaveBeenCalledTimes(2)
  })
})

describe('bottleOnTable', () => {
  it("casts the bottle's shadow right and back, away from the candle at the front left", () => {
    for (const shape of ['round', 'teardrop', 'tall', 'shoulder', 'gourd']) {
      const s = spec(shape)
      const { shadow, widthMm, footMm } = bottleOnTable(s)
      const pts = points(shadow)
      const xs = pts.map(([x]) => x!)
      const ys = pts.map(([, y]) => y!)
      expect(Math.max(...xs)).toBeGreaterThan(widthMm)
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-widthMm / 2 - 0.5)
      expect(Math.max(...ys)).toBeLessThanOrEqual(footMm * 0.15)
      expect(Math.min(...ys)).toBeLessThan(-5)
    }
  })

  it('ties the string round the neck, below the lip and above the body', () => {
    for (const shape of ['round', 'teardrop', 'tall', 'shoulder', 'gourd'])
      for (const neck of [0, 1]) {
        const s = spec(shape, neck)
        const { tie, widthMm } = bottleOnTable(s)
        expect(tie.halfWidthMm).toBeLessThan(widthMm / 4)
        expect(tie.heightMm).toBeGreaterThan(s.heightMm * 0.45)
        expect(tie.heightMm).toBeLessThan(s.heightMm - 20)
      }
  })

  it('sits the glow on the table beside the foot, inside the shadow', () => {
    const { glow, shadow } = bottleOnTable(spec('teardrop'))
    const xs = points(shadow).map(([x]) => x!)
    expect(glow.xMm).toBeGreaterThan(0)
    expect(glow.xMm).toBeLessThan(Math.max(...xs))
  })
})
