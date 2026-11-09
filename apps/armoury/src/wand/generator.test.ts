import { describe, expect, it } from 'vitest'

import { normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { buildWandMesh, radiusAt } from './geometry.ts'
import { wandPresets } from './presets.ts'
import { wandSchema } from './wandSchema.ts'

const designs = [
  ...wandPresets.map((p) => ({ name: p.name, params: normalise(wandSchema, p.params) })),
  ...Array.from({ length: 30 }, (_, i) => ({
    name: `random ${i}`,
    params: randomise(wandSchema, seededRandom(i + 1)),
  })),
]

const preset = (name: string) => {
  const found = wandPresets.find((p) => p.name === name)
  if (!found) throw new Error(`no preset ${name}`)
  return normalise(wandSchema, found.params)
}

describe('wand generator', () => {
  it.each(designs)('$name is closed at both ends and finite everywhere', ({ params }) => {
    const spec = compileWand(params)
    expect(spec.profile(0)).toBe(0)
    expect(spec.profile(spec.lengthMm)).toBe(0)
    const mesh = buildWandMesh(spec, { segments: 48, stepMm: 1 })
    expect(mesh.positions.every(Number.isFinite)).toBe(true)
    expect(mesh.normals.every(Number.isFinite)).toBe(true)
    const cols = mesh.segments + 1
    for (const j of [0, mesh.rings]) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 3
        expect(Math.hypot(mesh.positions[k]!, mesh.positions[k + 1]!)).toBeLessThan(1e-6)
      }
    }
  })

  it.each(designs)(
    '$name: carving only removes wood, and the handle stays in range',
    ({ params }) => {
      const spec = compileWand(params)
      for (let z = 0; z <= spec.lengthMm; z += 0.7) {
        for (let a = 0; a < Math.PI * 2; a += 0.13) {
          const { r, r0 } = radiusAt(spec, a, z)
          expect(r).toBeLessThanOrEqual(r0 + 1e-9)
          expect(r).toBeGreaterThanOrEqual(0)
          // Beads and flares may stand proud of the handle body, but not by much.
          expect(r0).toBeLessThan(spec.handleMaxR * 1.35)
        }
      }
    },
  )

  it('the gem-cut preset matches the measured 12" reference wand', () => {
    const spec = compileWand(preset('Gem cut'))
    expect(spec.lengthMm).toBeCloseTo(305)
    expect(spec.handleMaxR * 2).toBeCloseTo(15, 0)
    expect(spec.shaftBaseR * 2).toBeCloseTo(11, 0)
    expect(spec.tipR * 2).toBeGreaterThan(9.5)
    expect(spec.tipR * 2).toBeLessThan(11)
  })

  it('spiral width widens the shaft grooves without them merging', () => {
    const base = { ...preset('Gem cut'), handleCarving: 'flats', shaftGrooves: 3 }
    const width = (w: number) => {
      const spec = compileWand(normalise(wandSchema, { ...base, shaftGrooveWidth: w }))
      return spec.grooves.find((g) => g.from >= spec.handleMm)!.halfWidth
    }
    expect(width(0)).toBeLessThan(width(0.5))
    expect(width(0.5)).toBeLessThan(width(1))
    expect(width(1) * 2).toBeLessThan((Math.PI * 2) / 3)
  })

  it('spiral depth deepens the shaft grooves', () => {
    const depth = (d: number) => {
      const spec = compileWand(normalise(wandSchema, { ...preset('Gem cut'), shaftGrooveDepth: d }))
      return spec.grooves.find((g) => g.from >= spec.handleMm)!.depth
    }
    expect(depth(0)).toBeLessThan(depth(0.38))
    expect(depth(0.38)).toBeCloseTo(0.1, 2)
    expect(depth(0.38)).toBeLessThan(depth(1))
  })

  it('a longer shaft carving calms the handle gradually, never with a jump', () => {
    const handleDepth = (reach: number) => {
      const params = { ...preset('Long spiral'), shaftCarving: 'longSpiral', shaftReach: reach }
      const spec = compileWand(normalise(wandSchema, params))
      return spec.grooves.find((g) => g.to <= spec.handleMm)!.depth
    }
    expect(handleDepth(0.85)).toBeLessThan(handleDepth(0.3))
    for (let reach = 0.1; reach < 0.85; reach += 0.01) {
      expect(Math.abs(handleDepth(reach + 0.01) - handleDepth(reach))).toBeLessThan(0.003)
    }
  })

  it('the gem cut carves short, deep diamonds rather than long twisted flats', () => {
    const spec = compileWand(preset('Gem cut'))
    const [set] = spec.grooves.filter((g) => g.to <= spec.handleMm)
    const rows = 2 * set!.count * Math.abs(set!.twist) * (set!.to - set!.from)
    expect(rows).toBeGreaterThanOrEqual(10)
    expect(set!.depth).toBeGreaterThanOrEqual(0.15)
  })

  it('diamonds are two opposing flat groove sets', () => {
    const spec = compileWand(preset('Gem cut'))
    const handle = spec.grooves.filter((g) => g.to <= spec.handleMm)
    expect(handle.map((g) => [g.shape, Math.sign(g.twist)])).toEqual([
      ['flat', 1],
      ['flat', -1],
    ])
  })
})
