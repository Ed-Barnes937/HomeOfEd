import { describe, expect, it } from 'vitest'

import { defaults, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand, type WandSpec } from './compile.ts'
import { buildWandMesh, radiusAt } from './geometry.ts'
import { wandSchema } from './wandSchema.ts'

const branch = (extra: Record<string, unknown> = {}) =>
  normalise(wandSchema, { ...defaults(wandSchema), kind: 'branch', knots: 0, ...extra })

/** Fraction of the surface between two fractions of the length that is bark. */
const coverBetween = (spec: WandSpec, from: number, to: number) => {
  let bark = 0
  let n = 0
  for (let z = from * spec.lengthMm; z <= to * spec.lengthMm; z += 1)
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      bark += radiusAt(spec, a, z).bark
      n++
    }
  return bark / n
}

describe('bark', () => {
  it('a wand saved before bark opens bare, and a turned wand never has any', () => {
    expect(normalise(wandSchema, { kind: 'branch' }).bark).toBe('none')
    expect(compileWand(branch()).branch!.bark).toBeNull()
    const turned = (extra: Record<string, unknown>) =>
      buildWandMesh(compileWand(normalise(wandSchema, { kind: 'turned', ...extra })), {
        segments: 32,
        stepMm: 2,
      })
    const plain = turned({})
    const barked = turned({ bark: 'full' })
    expect(barked.positions).toEqual(plain.positions)
    expect(barked.stain).toEqual(plain.stain)
    expect(barked.bark.every((b) => b === 0)).toBe(true)
  })

  it('"Try another" rolls bark by its weights', () => {
    const def = wandSchema.params.find((d) => d.key === 'bark')
    if (def?.kind !== 'choice') throw new Error('no bark choice')
    expect(def.group).toBe('branch')
    expect(def.options.map((o) => o.value)).toEqual(['none', 'patches', 'full'])
    const counts: Record<string, number> = { none: 0, patches: 0, full: 0 }
    const rolls = 3000
    for (let i = 0; i < rolls; i++) counts[randomise(wandSchema, seededRandom(i)).bark as string]!++
    const total = def.options.reduce((sum, o) => sum + (o.weight ?? 1), 0)
    for (const o of def.options)
      expect(counts[o.value]! / rolls).toBeCloseTo((o.weight ?? 1) / total, 1)
  })

  it('full bark covers the shaft; patches cover some of it', () => {
    const full = coverBetween(compileWand(branch({ bark: 'full' })), 0.35, 0.85)
    const patches = coverBetween(compileWand(branch({ bark: 'patches' })), 0.35, 0.85)
    expect(full).toBeGreaterThan(0.95)
    expect(patches).toBeGreaterThan(0.25)
    expect(patches).toBeLessThan(0.75)
  })

  it('is worn through where a hand grips a grown handle, and stops at a turned one', () => {
    for (const branchSeed of [0, 31, 77]) {
      const grown = compileWand(branch({ bark: 'full', branchSeed }))
      expect(coverBetween(grown, 0.04, 0.2)).toBeLessThan(0.02)
      const turned = compileWand(branch({ bark: 'full', branchSeed, branchHandle: 'turned' }))
      expect(coverBetween(turned, 0, turned.branch!.from / turned.lengthMm)).toBe(0)
    }
  })

  it('stands proud of the wood, cut by furrows, and stays inside the envelope', () => {
    const bare = compileWand(branch({ gnarl: 1, knots: 6 }))
    const barked = compileWand(branch({ gnarl: 1, knots: 6, bark: 'full' }))
    const lifts: number[] = []
    let furthest = 0
    for (let z = 0.3 * bare.lengthMm; z < 0.85 * bare.lengthMm; z += 0.5)
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const { r, r0, bark } = radiusAt(barked, a, z)
        furthest = Math.max(furthest, Math.abs(r - r0) / r0)
        if (bark > 0.99) lifts.push((r - radiusAt(bare, a, z).r) / r0)
      }
    expect(Math.min(...lifts)).toBeGreaterThanOrEqual(-1e-9)
    expect(Math.max(...lifts)).toBeGreaterThan(0.04)
    // The furrows go down nearly to the wood.
    expect(lifts.filter((l) => l < 0.015).length / lifts.length).toBeGreaterThan(0.03)
    expect(furthest).toBeLessThanOrEqual(0.25)
  })

  it('keeps off metal, gems and engravings', () => {
    const spec = compileWand(
      branch({
        bark: 'full',
        branchHandle: 'turned',
        bands: 'three',
        gems: 'line',
        gemCount: 5,
        stencil: 'vine',
        stencilWhere: 'handle',
      }),
    )
    for (const zone of spec.zones)
      for (let z = zone.from; z <= zone.to; z += 0.25)
        for (let a = 0; a < Math.PI * 2; a += 0.2) expect(radiusAt(spec, a, z).bark).toBe(0)
    for (const gem of spec.gems) expect(radiusAt(spec, gem.theta, gem.z).bark).toBe(0)
    for (const band of spec.stencil!.bands)
      for (let z = band.from; z <= band.to; z += 0.5) expect(radiusAt(spec, 0, z).bark).toBe(0)
  })

  it('takes only a little of the stain that soaks into bare wood', () => {
    const stain = { stainColour: 'smoky', stainStrength: 0.8, stainReach: 1 }
    const mesh = (bark: string) =>
      buildWandMesh(compileWand(branch({ ...stain, bark })), { segments: 48, stepMm: 1 })
    const bare = mesh('none')
    const barked = mesh('full')
    let onBark = 0
    let onWood = 0
    let n = 0
    for (let k = 0; k < barked.bark.length; k++)
      if (barked.bark[k]! > 0.99) {
        onBark += barked.stain[k]!
        onWood += bare.stain[k]!
        n++
      }
    expect(n).toBeGreaterThan(100)
    expect(onBark / onWood).toBeLessThan(0.45)
    expect(onBark).toBeGreaterThan(0)
  })

  it('grows from "Which branch" alone, so the knots, lumps, bend or colour keep the same bark', () => {
    const cover = (extra: Record<string, unknown>) =>
      buildWandMesh(compileWand(branch({ bark: 'patches', ...extra })), {
        segments: 32,
        stepMm: 2,
      }).bark
    expect(cover({ branchSeed: 7 })).toEqual(cover({ branchSeed: 7 }))
    expect(cover({ branchSeed: 7, knots: 0, stainColour: 'midnight' })).toEqual(
      cover({ branchSeed: 7, knots: 0 }),
    )
    expect(cover({ branchSeed: 8 })).not.toEqual(cover({ branchSeed: 7 }))
    const bark = (extra: Record<string, unknown>) =>
      compileWand(branch({ bark: 'patches', branchSeed: 7, ...extra })).branch!.bark
    expect(bark({ knots: 6, gnarl: 1, bend: 1 })).toEqual(bark({ knots: 0, gnarl: 0, bend: 0 }))
  })
})
