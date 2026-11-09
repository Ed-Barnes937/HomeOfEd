import { describe, expect, it } from 'vitest'

import { isVisible, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { buildWandMesh, radiusAt } from './geometry.ts'
import { wandPresets } from './presets.ts'
import { wandSchema } from './wandSchema.ts'

const preset = (name: string) => {
  const found = wandPresets.find((p) => p.name === name)
  if (!found) throw new Error(`no preset ${name}`)
  return normalise(wandSchema, found.params)
}

const wand = (extra: Record<string, unknown>, base = 'Midnight') =>
  compileWand(normalise(wandSchema, { ...preset(base), ...extra }))

/** The material on the wand's surface at z: wood unless a zone covers it. */
const surfaceAt = (spec: ReturnType<typeof compileWand>, z: number) => {
  const mesh = buildWandMesh(spec, { segments: 16, stepMm: 0.5 })
  const j = Math.round((z / spec.lengthMm) * mesh.rings)
  const k = j * (mesh.segments + 1)
  const [metal, paint, bone] = [0, 1, 2].map((c) => mesh.zone[k * 3 + c]!)
  const stain = mesh.stain[k]!
  const material = metal! > 0.5 ? 'metal' : paint! > 0.5 ? 'paint' : bone! > 0.5 ? 'bone' : 'wood'
  return { material, stain }
}

describe('material zones', () => {
  it('a wand saved before decorations opens all wood', () => {
    const spec = compileWand(preset('Midnight'))
    expect(spec.zones).toEqual([])
    const mesh = buildWandMesh(spec, { segments: 16, stepMm: 1 })
    expect(mesh.zone.every((w) => w === 0)).toBe(true)
  })

  it('a metal end cap covers the pommel and stops short of the handle carving', () => {
    const spec = wand({ endCap: 'metal' })
    expect(surfaceAt(spec, 1).material).toBe('metal')
    expect(surfaceAt(spec, spec.handleMm * 0.5).material).toBe('wood')
    expect(surfaceAt(spec, spec.lengthMm * 0.6).material).toBe('wood')
  })

  it('the handle and shaft can be metal, painted or bone, each over its own stretch', () => {
    const spec = wand({ handleFinish: 'metal', shaftFinish: 'paint' })
    const collarMid = spec.handleMm + 4
    expect(surfaceAt(spec, spec.handleMm * 0.5).material).toBe('metal')
    expect(surfaceAt(spec, collarMid).material).toBe('metal')
    expect(surfaceAt(spec, spec.lengthMm * 0.6).material).toBe('paint')
    expect(surfaceAt(wand({ handleFinish: 'bone' }), spec.handleMm * 0.5).material).toBe('bone')
  })

  it('the ring takes the finish the handle and shaft share, unless it or the handle is metal', () => {
    const ringOf = (extra: Record<string, unknown>) => {
      const spec = wand(extra)
      return surfaceAt(spec, spec.handleMm + 4).material
    }
    expect(ringOf({ handleFinish: 'bone', shaftFinish: 'bone' })).toBe('bone')
    expect(ringOf({ handleFinish: 'paint', shaftFinish: 'paint' })).toBe('paint')
    expect(ringOf({ handleFinish: 'paint', shaftFinish: 'wood' })).toBe('wood')
    expect(ringOf({ handleFinish: 'metal', shaftFinish: 'wood', collarFinish: 'wood' })).toBe(
      'metal',
    )
    expect(ringOf({ handleFinish: 'bone', shaftFinish: 'bone', collarFinish: 'metal' })).toBe(
      'metal',
    )
  })

  it('stain soaks into wood and bone but not metal or paint, and still fades along the wood', () => {
    const base = { stainColour: 'midnight', stainStrength: 1, stainReach: 0.5 }
    const handle = (handleFinish: string) => {
      const spec = wand({ ...base, handleFinish })
      return surfaceAt(spec, spec.handleMm * 0.5).stain
    }
    expect(handle('wood')).toBeGreaterThan(0.5)
    expect(handle('bone')).toBeGreaterThan(0.5)
    expect(handle('metal')).toBe(0)
    expect(handle('paint')).toBe(0)
    const spec = wand({ ...base, handleFinish: 'metal' })
    expect(surfaceAt(spec, spec.handleMm + 14).stain).toBeGreaterThan(0.5)
    expect(surfaceAt(spec, spec.lengthMm * 0.9).stain).toBe(0)
  })

  const bandsOf = (spec: ReturnType<typeof compileWand>) =>
    spec.zones.filter((z) => z.material === 'metal' && z.from > spec.handleMm)

  it.each([
    ['none', 0],
    ['one', 1],
    ['two', 2],
    ['three', 3],
  ])('%s metal bands go up the shaft as thin rings', (bands, count) => {
    const spec = wand({ bands })
    expect(bandsOf(spec)).toHaveLength(count)
    for (const band of bandsOf(spec)) {
      expect(band.to - band.from).toBeLessThan(4)
      expect(surfaceAt(spec, (band.from + band.to) / 2).material).toBe('metal')
      expect(spec.profile((band.from + band.to) / 2)).toBeGreaterThan(
        wand({}).profile((band.from + band.to) / 2),
      )
    }
  })

  it('three bands fit between two bumps on the shortest wand', () => {
    const bumpy = { lengthCm: 28, nodes: 'knobs', nodeCount: 2, bands: 'three' }
    const spec = wand({ ...bumpy, handleStyle: 'plain', collarStyle: 'vcut' })
    expect(bandsOf(spec)).toHaveLength(3)
  })

  it.each(['knobs', 'rings'])('bands sit in the gaps between %s, not on them', (nodes) => {
    const bumpy = { nodes, nodeCount: 4, nodeSize: 1 }
    const spec = wand({ ...bumpy, bands: 'three' })
    const bare = wand(bumpy)
    const smooth = wand({})
    for (const band of bandsOf(spec)) {
      for (let z = band.from; z <= band.to; z += 0.25)
        expect(bare.profile(z)).toBeCloseTo(smooth.profile(z), 6)
    }
  })

  it('carving and raised spirals stop at a band', () => {
    for (const spiralStyle of ['cut', 'raised']) {
      const spec = wand({ bands: 'two', shaftCarving: 'longSpiral', shaftReach: 0.85, spiralStyle })
      for (const band of bandsOf(spec)) {
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const { r, r0 } = radiusAt(spec, a, (band.from + band.to) / 2)
          expect(r).toBeCloseTo(r0, 6)
        }
      }
    }
  })

  it('a metal raised spiral is a metal ribbon wound round wood', () => {
    const spiral = { shaftCarving: 'longSpiral', spiralStyle: 'raised', ridgeHeight: 1 }
    const spec = wand({ ...spiral, ridgeFinish: 'metal' })
    const mesh = buildWandMesh(spec, { segments: 128, stepMm: 1 })
    const z = spec.handleMm + 40
    const j = Math.round((z / spec.lengthMm) * mesh.rings)
    const ring = Array.from({ length: mesh.segments }, (_, i) => {
      const k = j * (mesh.segments + 1) + i
      const { r, r0 } = radiusAt(
        spec,
        (Math.PI * 2 * i) / mesh.segments,
        (spec.lengthMm * j) / mesh.rings,
      )
      return { proud: (r - r0) / r0, metal: mesh.zone[k * 3]!, stain: mesh.stain[k]! }
    })
    const crest = Math.max(...ring.map((v) => v.proud))
    for (const v of ring) {
      if (v.proud > 0.6 * crest) expect(v.metal).toBeGreaterThan(0.9)
      if (v.proud === 0) expect(v.metal).toBe(0)
    }
    const solid = ring.filter((v) => v.metal === 1)
    expect(solid.length).toBeGreaterThan(0)
    expect(solid.every((v) => v.stain === 0)).toBe(true)
    const woodRidge = buildWandMesh(wand(spiral), { segments: 32, stepMm: 1 })
    expect(woodRidge.zone.every((w) => w === 0)).toBe(true)
  })

  it('only a raised spiral can be metal', () => {
    const spec = wand({ shaftCarving: 'longSpiral', spiralStyle: 'cut', ridgeFinish: 'metal' })
    expect(buildWandMesh(spec, { segments: 32, stepMm: 1 }).zone.every((w) => w === 0)).toBe(true)
  })

  it('paint is a curated colour, not a free pick', () => {
    const paint = wandSchema.params.find((d) => d.key === 'paintColour')!
    expect(paint.kind).toBe('choice')
    expect(normalise(wandSchema, { paintColour: '#ff00ff' }).paintColour).toBe(paint.default)
    expect(wand({ shaftFinish: 'paint', paintColour: 'marigold' }).paint).not.toEqual(
      wand({ shaftFinish: 'paint', paintColour: 'ink' }).paint,
    )
  })

  it('try another makes mostly wooden wands, with metal as an occasional treat', () => {
    const rng = seededRandom(7)
    const rolls = Array.from({ length: 2000 }, () => compileWand(randomise(wandSchema, rng)))
    const share = (test: (spec: (typeof rolls)[number]) => boolean) =>
      rolls.filter(test).length / rolls.length
    const metal = share(
      (spec) =>
        spec.zones.some((z) => z.material === 'metal') ||
        spec.grooves.some((g) => g.shape === 'round' && g.metal),
    )
    expect(metal).toBeGreaterThan(0.15)
    expect(metal).toBeLessThan(0.35)
    expect(share((spec) => spec.zones.length === 0)).toBeGreaterThan(0.5)
    expect(share((spec) => spec.zones.some((z) => z.material === 'paint'))).toBeGreaterThan(0.05)
    expect(share((spec) => spec.zones.some((z) => z.material === 'bone'))).toBeGreaterThan(0.05)
  })
})

describe('the presets', () => {
  it('show metal off on at least one wand: handle, ring and spiral', () => {
    const metalParts = (params: Record<string, unknown>) =>
      ['handleFinish', 'collarFinish', 'ridgeFinish', 'endCap'].filter((k) => params[k] === 'metal')
        .length + (params.bands && params.bands !== 'none' ? 1 : 0)
    expect(Math.max(...wandPresets.map((p) => metalParts(p.params)))).toBeGreaterThanOrEqual(3)
  })
})

describe('the decorations controls', () => {
  const shown = (extra: Record<string, unknown>, key: string) =>
    isVisible(
      wandSchema.params.find((d) => d.key === key)!,
      normalise(wandSchema, { ...preset('Midnight'), ...extra }),
    )

  it('offer a metal only once something is metal, and paint only once something is painted', () => {
    expect(shown({}, 'metal')).toBe(false)
    expect(shown({ bands: 'one' }, 'metal')).toBe(true)
    expect(shown({}, 'paintColour')).toBe(false)
    expect(shown({ shaftFinish: 'paint' }, 'paintColour')).toBe(true)
  })

  it('drop the end cap on a metal handle, which is metal to the end anyway', () => {
    expect(shown({}, 'endCap')).toBe(true)
    expect(shown({ handleFinish: 'metal' }, 'endCap')).toBe(false)
  })

  it('drop the ring choice on a metal handle, whose ring is always its metal', () => {
    expect(shown({}, 'collarFinish')).toBe(true)
    expect(shown({ handleFinish: 'metal' }, 'collarFinish')).toBe(false)
  })

  it('offer a metal spiral only on a raised spiral', () => {
    expect(shown({ spiralStyle: 'cut' }, 'ridgeFinish')).toBe(false)
    expect(shown({ spiralStyle: 'raised' }, 'ridgeFinish')).toBe(true)
  })
})
