import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compileSword } from './compile.ts'
import { engravingMask, runeMask } from './runes.ts'
import { swordSchema } from './swordSchema.ts'

const specOf = (raw: Record<string, unknown>) => compileSword(normalise(swordSchema, raw))

const RUNED = [
  { family: 'knight', middle: 'groove1', runes: 'groove' },
  { family: 'knight', middle: 'groove1', runes: 'base' },
  { family: 'longsword', middle: 'groove2', runes: 'groove' },
  { family: 'knight', middle: 'flat', runes: 'centre' },
  { family: 'longsword', middle: 'ridge', runes: 'centre' },
  { family: 'sabre', middle: 'flat', runes: 'base' },
  { family: 'katana', middle: 'ridge', runes: 'base' },
  { family: 'katana', middle: 'ridgeGroove', runes: 'groove' },
]

describe('runeMask', () => {
  it('is null without runes', () => {
    expect(runeMask(specOf({ family: 'knight', runes: 'none' }))).toBeNull()
  })

  it('is the same bytes for the same seed, and differs for another', () => {
    const a = runeMask(specOf({ family: 'knight', middle: 'groove1', runes: 'groove' }))!
    const b = runeMask(specOf({ family: 'knight', middle: 'groove1', runes: 'groove' }))!
    expect(a.data).toEqual(b.data)
    const c = runeMask(specOf({ family: 'knight', middle: 'groove1', runes: 'groove', bladeLength: 0.8 }))!
    expect(c.data).not.toEqual(a.data)
  })

  it('cuts every glyph inside its band and leaves the gaps between them clear', () => {
    for (const raw of RUNED) {
      const spec = specOf(raw)
      const r = spec.runes!
      expect(r, JSON.stringify(raw)).not.toBeNull()
      const mask = runeMask(spec)!
      expect(mask.rect.from).toBe(r.from)
      expect(mask.rect.to).toBe(r.to)
      expect(mask.width * mask.height).toBeLessThanOrEqual(2048 * 2048)
      const column = (i: number) => {
        let cut = 0
        for (let j = 0; j < mask.height; j++) cut = Math.max(cut, mask.data[j * mask.width + i]!)
        return cut
      }
      const pitch = mask.width / r.glyphs
      for (let k = 0; k < r.glyphs; k++) {
        let most = 0
        for (let i = Math.floor(k * pitch); i < Math.floor((k + 1) * pitch); i++) most = Math.max(most, column(i))
        expect(most, `${JSON.stringify(raw)} glyph ${k}`).toBeGreaterThan(200)
        if (k > 0) expect(column(Math.floor(k * pitch)), `${JSON.stringify(raw)} gap ${k}`).toBe(0)
      }
    }
  })

  it('follows the fuller it sits in', () => {
    const spec = specOf({ family: 'knight', middle: 'groove1', runes: 'groove' })
    const mask = runeMask(spec)!
    const f = spec.blade.fullers[0]!
    const centreX = (mask.rect.x0 + mask.rect.x1) / 2
    expect(Math.abs(centreX)).toBeLessThan(f.halfWidth * 5)
    expect(mask.rect.x1 - mask.rect.x0).toBeLessThan(2 * spec.runes!.halfHeight + 2)
  })
})

describe('engravingMask', () => {
  it('is null without engraving, deterministic, and cut inside its band', () => {
    expect(engravingMask(specOf({ family: 'knight', engraving: 'none' }))).toBeNull()
    for (const tile of ['vine', 'knotwork', 'scales', 'dots']) {
      const spec = specOf({ family: 'knight', engraving: tile })
      const a = engravingMask(spec)!
      expect(a, tile).not.toBeNull()
      expect(engravingMask(specOf({ family: 'knight', engraving: tile }))!.data).toEqual(a.data)
      const cut = a.data.filter((v) => v > 128).length
      expect(cut / a.data.length, tile).toBeGreaterThan(0.03)
      for (let j = 0; j < a.height; j++) expect(a.data[j * a.width]).toBeLessThan(8)
    }
  })
})
