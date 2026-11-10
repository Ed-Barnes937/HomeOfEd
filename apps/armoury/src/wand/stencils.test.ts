import { describe, expect, it, vi } from 'vitest'

import { allowedOptions, isVisible, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand, type WandSpec } from './compile.ts'
import { SHOWN_SIDE } from './gems.ts'
import { buildWandMesh, radiusAt } from './geometry.ts'
import { wandPresets } from './presets.ts'
import { STENCILS, stencilHeight, type StencilName } from './stencils.ts'
import { wandSchema } from './wandSchema.ts'

const names = Object.keys(STENCILS) as StencilName[]
const TAU = Math.PI * 2

const midnight = wandPresets.find((p) => p.name === 'Midnight')!.params
const wand = (extra: Record<string, unknown>) =>
  compileWand(normalise(wandSchema, { ...midnight, handleCarving: 'none', ...extra }))

/** How far the stencil moves the surface from the same wand without it, at each sampled z. */
function cutAlong(extra: Record<string, unknown>) {
  const plain = wand({ ...extra, stencil: 'none' })
  const carved = wand(extra)
  const cuts: { z: number; deepest: number; highest: number }[] = []
  for (let z = 0; z <= carved.lengthMm; z += 0.5) {
    let deepest = 0
    let highest = -Infinity
    for (let a = 0; a < TAU; a += 0.04) {
      const d = radiusAt(carved, a, z).r - radiusAt(plain, a, z).r
      deepest = Math.min(deepest, d)
      highest = Math.max(highest, d)
    }
    cuts.push({ z, deepest, highest })
  }
  return { spec: carved, cuts }
}

const carvedStretch = (cuts: { z: number; deepest: number }[]): [number, number] => {
  const carved = cuts.filter((c) => c.deepest < -1e-6)
  return [carved[0]?.z ?? NaN, carved.at(-1)?.z ?? NaN]
}

describe('stencil choices', () => {
  const def = (key: string) => wandSchema.params.find((d) => d.key === key)!
  const places = (extra: Record<string, unknown>) => {
    const p = normalise(wandSchema, { ...extra, stencil: 'scales' })
    const where = def('stencilWhere')
    return where.kind === 'choice' && isVisible(where, p)
      ? allowedOptions(where, p).map((o) => o.value)
      : []
  }

  it('a turned wand can carry a pattern on its handle, up its shaft or all over', () => {
    expect(places({})).toEqual(['handle', 'shaft', 'all'])
    expect(places({ handleFinish: 'metal' })).toEqual(['shaft', 'all'])
  })

  it('a branch carries a pattern only on a turned handle, as it has no shaft carving', () => {
    expect(places({ kind: 'branch', branchHandle: 'turned' })).toEqual(['handle'])
    expect(places({ kind: 'branch', branchHandle: 'grown' })).toEqual([])
    const grown = normalise(wandSchema, { kind: 'branch', stencil: 'vine', stencilWhere: 'shaft' })
    expect(isVisible(def('stencil'), grown)).toBe(false)
    expect(compileWand(grown).stencil).toBeNull()
    const turned = normalise(wandSchema, { ...grown, branchHandle: 'turned' })
    expect(compileWand(turned).stencil?.bands).toHaveLength(1)
    expect(compileWand(turned).stencil!.bands[0]!.to).toBeLessThan(compileWand(turned).handleMm)
  })

  it('a wand saved before stencils opens plain', () => {
    const saved = normalise(wandSchema, midnight)
    expect(saved.stencil).toBe('none')
    expect(compileWand(saved).stencil).toBeNull()
  })

  it('try another carves a pattern now and then, mostly on the handle', () => {
    const rng = seededRandom(23)
    const rolls = Array.from({ length: 3000 }, () => randomise(wandSchema, rng))
    const carved = rolls.filter((p) => compileWand(p).stencil)
    expect(carved.length / rolls.length).toBeGreaterThan(0.05)
    expect(carved.length / rolls.length).toBeLessThan(0.12)
    const onHandle = carved.filter((p) => p.stencilWhere === 'handle').length
    expect(onHandle / carved.length).toBeGreaterThan(0.4)
  })
})

describe('stencils on the wand', () => {
  it('scales on the handle cut into the handle and nowhere else, and only remove wood', () => {
    const { spec, cuts } = cutAlong({ stencil: 'scales', stencilWhere: 'handle' })
    expect(Math.max(...cuts.map((c) => c.highest))).toBeLessThanOrEqual(1e-9)
    const [from, to] = carvedStretch(cuts)
    expect(from).toBeGreaterThan(0)
    expect(to).toBeLessThan(spec.handleMm)
    expect(to - from).toBeGreaterThan(0.5 * spec.handleMm)
  })

  it.each(names)('%s wraps round the wand without a seam', (stencil) => {
    const spec: WandSpec = wand({ stencil, stencilWhere: 'all' })
    let worst = 0
    for (let z = 0; z < spec.lengthMm; z += 0.5) {
      const a = radiusAt(spec, 1e-5, z).r
      const b = radiusAt(spec, TAU - 1e-5, z).r
      worst = Math.max(worst, Math.abs(a - b))
    }
    expect(worst).toBeLessThan(1e-3)
  })

  it.each([
    ['Gem cut', {}],
    ['Gem cut', { handleCarving: 'flats' }],
    ['Long spiral', { handleCarving: 'flutes' }],
  ])('a pattern on a %s handle %o replaces the handle carving across its band', (base, extra) => {
    const params = { ...wandPresets.find((p) => p.name === base)!.params, ...extra }
    const spec = compileWand(
      normalise(wandSchema, { ...params, stencil: 'scales', stencilWhere: 'handle' }),
    )
    expect(spec.grooves.some((g) => g.to <= spec.handleMm)).toBe(true)
    const band = spec.stencil!.bands[0]!
    let checked = 0
    for (let z = band.from + 2; z < band.to - 2; z += 0.37) {
      for (let a = 0; a < TAU; a += 0.09) {
        const { r, r0 } = radiusAt(spec, a, z)
        const h = stencilHeight(
          'scales',
          ((a - SHOWN_SIDE) / TAU) * band.around + 0.5,
          (z - band.from) / band.length,
        )
        expect(r).toBeCloseTo(r0 * (1 - spec.stencil!.depth * (1 - h)), 9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it('a raised spiral still stands over a pattern up the shaft', () => {
    const spec = wand({
      shaftCarving: 'longSpiral',
      spiralStyle: 'raised',
      stencil: 'dots',
      stencilWhere: 'shaft',
    })
    let proud = 0
    for (let z = spec.handleMm + 20; z < spec.lengthMm * 0.4; z += 0.5)
      for (let a = 0; a < TAU; a += 0.05)
        if (radiusAt(spec, a, z).r > radiusAt(spec, a, z).r0) proud++
    expect(proud).toBeGreaterThan(100)
  })

  it('a stencil keeps clear of metal: the end cap, the ring and the bands', () => {
    const extra = {
      stencil: 'dots',
      stencilWhere: 'all',
      endCap: 'metal',
      collarFinish: 'metal',
      bands: 'three',
    }
    const { spec, cuts } = cutAlong(extra)
    const metal = spec.zones.filter((z) => z.material === 'metal')
    expect(metal.length).toBeGreaterThanOrEqual(5)
    for (const zone of metal) {
      for (const c of cuts) if (c.z >= zone.from && c.z <= zone.to) expect(c.deepest).toBe(0)
    }
    const [from, to] = carvedStretch(cuts)
    expect(to - from).toBeGreaterThan(0.5 * spec.lengthMm)
  })

  it('a stencil stays off a metal spiral', () => {
    const extra = {
      shaftCarving: 'longSpiral',
      spiralStyle: 'raised',
      ridgeFinish: 'metal',
      stencil: 'knotwork',
      stencilWhere: 'shaft',
    }
    const plain = wand({ ...extra, stencil: 'none' })
    const carved = wand(extra)
    let onMetal = 0
    for (let z = carved.handleMm + 15; z < carved.lengthMm * 0.5; z += 0.5) {
      for (let a = 0; a < TAU; a += 0.05) {
        if (radiusAt(plain, a, z).metal < 1) continue
        onMetal++
        expect(radiusAt(carved, a, z).r).toBeCloseTo(radiusAt(plain, a, z).r, 9)
      }
    }
    expect(onMetal).toBeGreaterThan(50)
  })

  it('gems sit in their seats over a stencil, uncut', () => {
    const extra = { stencil: 'scales', stencilWhere: 'all', gems: 'line', gemCount: 5 }
    const plain = wand({ ...extra, stencil: 'none' })
    const carved = wand(extra)
    expect(carved.gems).toHaveLength(5)
    for (const gem of carved.gems) {
      for (const [da, dz] of [
        [0, 0],
        [0, gem.radius],
        [0, -gem.radius],
      ] as const) {
        const at = (s: WandSpec) => radiusAt(s, gem.theta + da, gem.z + dz).r
        expect(at(carved)).toBeCloseTo(at(plain), 9)
      }
    }
  })

  it('stain pools in a stencil cut, as in a groove', () => {
    const spec = wand({
      stencil: 'dots',
      stencilWhere: 'shaft',
      stencilSize: 1,
      stainStrength: 0.5,
      stainReach: 1,
    })
    const mesh = buildWandMesh(spec, { segments: 128 })
    const band = spec.stencil!.bands[0]!
    const cols = mesh.segments + 1
    let inCut = 0
    let onTop = Infinity
    for (let j = 0; j <= mesh.rings; j++) {
      const z = mesh.positions[j * cols * 3 + 2]!
      if (z < band.from + 3 || z > band.to - 3) continue
      for (let i = 0; i < mesh.segments; i++) {
        inCut = Math.max(inCut, mesh.stain[j * cols + i]!)
        onTop = Math.min(onTop, mesh.stain[j * cols + i]!)
      }
    }
    expect(inCut - onTop).toBeGreaterThan(0.15)
  })

  it('a stencil band is built from rings half as far apart, so its edges never step', () => {
    const ringsOf = (stencil: string) =>
      buildWandMesh(wand({ stencil, stencilWhere: 'handle' }), { segments: 16 }).rings
    const band = wand({ stencil: 'vine', stencilWhere: 'handle' }).stencil!.bands[0]!
    expect(ringsOf('vine') - ringsOf('none')).toBeCloseTo((band.to - band.from) / 0.5, -1)
  })

  it('the same choices carve the same wand, even with the tiles drawn afresh', async () => {
    const params = { stencil: 'vine', stencilWhere: 'all', stencilSize: 0.3 }
    const a = buildWandMesh(wand(params), { segments: 64, stepMm: 1 })
    vi.resetModules()
    const fresh = {
      compile: await import('./compile.ts'),
      geometry: await import('./geometry.ts'),
    }
    const spec = fresh.compile.compileWand(
      normalise(wandSchema, { ...midnight, handleCarving: 'none', ...params }),
    )
    const b = fresh.geometry.buildWandMesh(spec, { segments: 64, stepMm: 1 })
    expect(b.positions).toEqual(a.positions)
  })
})

describe('stencil tiles', () => {
  it.each(names)('%s tiles without a seam, round the wand and along it', (name) => {
    let worst = 0
    for (let t = 0; t < 1; t += 0.01) {
      worst = Math.max(
        worst,
        Math.abs(STENCILS[name].draw(0, t) - STENCILS[name].draw(1, t)),
        Math.abs(STENCILS[name].draw(t, 0) - STENCILS[name].draw(t, 1)),
      )
    }
    expect(worst).toBeLessThan(1e-9)
  })

  it.each(names)('%s has both carved and uncarved wood, between 0 and 1', (name) => {
    const heights: number[] = []
    for (let u = 0; u < 1; u += 0.02)
      for (let v = 0; v < 1; v += 0.02) heights.push(stencilHeight(name, u, v))
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...heights)).toBeLessThanOrEqual(1)
    expect(Math.min(...heights)).toBeLessThan(0.4)
    expect(Math.max(...heights)).toBeGreaterThan(0.9)
  })

  it.each(names)('%s samples the same height a whole tile away, in either direction', (name) => {
    for (const [u, v] of [
      [0.13, 0.71],
      [0.5, 0.02],
      [0.98, 0.4],
    ] as const) {
      const h = stencilHeight(name, u, v)
      expect(stencilHeight(name, u + 3, v)).toBeCloseTo(h, 9)
      expect(stencilHeight(name, u - 2, v + 5)).toBeCloseTo(h, 9)
    }
  })
})
