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

// Carving and raised ridges stay within this fraction of the local profile radius.
const ENVELOPE = 0.25
const LONGEST_COLLAR = 12

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
    '$name: the surface stays close to the profile, and nothing outgrows the handle',
    ({ params }) => {
      const spec = compileWand(params)
      let furthestOut = 0
      let thinnest = Infinity
      let widest = 0
      for (let z = 0; z <= spec.lengthMm; z += 0.7) {
        for (let a = 0; a < Math.PI * 2; a += 0.13) {
          const { r, r0 } = radiusAt(spec, a, z)
          if (r0 > 0) furthestOut = Math.max(furthestOut, Math.abs(r - r0) / r0)
          thinnest = Math.min(thinnest, r)
          widest = Math.max(widest, r, r0)
        }
      }
      expect(furthestOut).toBeLessThanOrEqual(ENVELOPE)
      expect(thinnest).toBeGreaterThanOrEqual(0)
      // Beads, flares, bumps and ridges may stand proud of the handle body, but not by much.
      expect(widest).toBeLessThan(spec.handleMaxR * 1.35)
    },
  )

  it('a raised spiral stands proud of the shaft where a cut one sinks into it', () => {
    const shaft = (spiralStyle: string) => {
      const spec = compileWand(normalise(wandSchema, { ...preset('Midnight'), spiralStyle }))
      const offsets: number[] = []
      for (let z = spec.handleMm + 20; z < spec.lengthMm * 0.5; z += 1) {
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const { r, r0 } = radiusAt(spec, a, z)
          offsets.push(r - r0)
        }
      }
      return { highest: Math.max(...offsets), lowest: Math.min(...offsets) }
    }
    expect(shaft('cut').highest).toBeLessThanOrEqual(0)
    expect(shaft('cut').lowest).toBeLessThan(0)
    expect(shaft('raised').lowest).toBeGreaterThanOrEqual(0)
    expect(shaft('raised').highest).toBeGreaterThan(0)
  })

  const noded = (extra: Record<string, unknown>) => {
    const smooth = compileWand(preset('Simple oak'))
    const spec = compileWand(normalise(wandSchema, { ...preset('Simple oak'), ...extra }))
    const swell = (z: number) => spec.profile(z) - smooth.profile(z)
    const peaks: { z: number; height: number }[] = []
    for (let z = spec.handleMm + LONGEST_COLLAR; z < spec.lengthMm; z += 0.25) {
      const r = spec.profile(z)
      if (r > spec.profile(z - 0.25) && r >= spec.profile(z + 0.25))
        peaks.push({ z, height: swell(z) })
    }
    return { spec, swell, peaks }
  }

  it.each(['knobs', 'rings'])('%s swell the shaft at evenly spaced points', (nodes) => {
    for (const nodeCount of [2, 4, 7]) {
      const { peaks } = noded({ nodes, nodeCount })
      expect(peaks).toHaveLength(nodeCount)
      const gaps = peaks.slice(1).map((p, i) => p.z - peaks[i]!.z)
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, -0.5)
    }
  })

  it.each(['knobs', 'rings'])(
    '%s shrink towards the tip, keep clear of the collar and leave the point alone',
    (nodes) => {
      const { spec, swell, peaks } = noded({ nodes, nodeCount: 5, nodeSize: 1 })
      const heights = peaks.map((p) => p.height / spec.profile(p.z))
      for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThan(heights[i - 1]!)
      for (let z = 0; z <= spec.handleMm + LONGEST_COLLAR; z += 0.5) expect(swell(z)).toBe(0)
      for (let z = spec.lengthMm * 0.88; z <= spec.lengthMm; z += 0.5) expect(swell(z)).toBe(0)
    },
  )

  it('bigger bumps stand further out', () => {
    const tallest = (nodeSize: number) =>
      Math.max(...noded({ nodes: 'knobs', nodeSize }).peaks.map((p) => p.height))
    expect(tallest(0)).toBeGreaterThan(0)
    expect(tallest(0)).toBeLessThan(tallest(0.5))
    expect(tallest(0.5)).toBeLessThan(tallest(1))
  })

  it('a wand saved before bumps and raised spirals opens with neither', () => {
    const saved = wandPresets.find((p) => p.name === 'Midnight')!.params
    expect(normalise(wandSchema, saved)).toMatchObject({ nodes: 'none', spiralStyle: 'cut' })
    const spec = compileWand(normalise(wandSchema, saved))
    expect(spec.grooves.every((g) => g.depth > 0)).toBe(true)
  })

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

  it('big bumps on the shaft calm the handle gradually, never with a jump', () => {
    const handleDepth = (nodeSize: number) => {
      const params = { ...preset('Midnight'), shaftCarving: 'none', nodes: 'knobs', nodeSize }
      const spec = compileWand(normalise(wandSchema, params))
      return spec.grooves.find((g) => g.to <= spec.handleMm)!.depth
    }
    expect(handleDepth(1)).toBeLessThan(handleDepth(0))
    for (let size = 0; size < 1; size += 0.01) {
      expect(Math.abs(handleDepth(size + 0.01) - handleDepth(size))).toBeLessThan(0.003)
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
