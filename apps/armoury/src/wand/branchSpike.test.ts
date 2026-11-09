// SPIKE (ticket 02): measurements, not a shipping test.
import { describe, expect, it } from 'vitest'

import { defaults, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { buildWandMesh, spineFrame, spineOffset } from './geometry.ts'
import { wandSchema } from './wandSchema.ts'

const branch = (over: Record<string, unknown>) =>
  normalise(wandSchema, { ...defaults(wandSchema), kind: 'branch', ...over })

describe('branch spike', () => {
  it('measures the bend across the ranges', () => {
    const rows: string[] = []
    let worstMargin = Infinity
    for (const lengthCm of [28, 33, 38])
      for (const bend of [0, 0.5, 1])
        for (const wiggle of [0, 0.5, 1])
          for (let seed = 0; seed < 25; seed++) {
            const spec = compileWand(
              branch({ lengthCm, bend, wiggle, gnarl: 1, knots: 7, branchSeed: seed, thickness: 1.15 }),
            )
            const L = spec.lengthMm
            let maxOff = 0
            let minRadiusOfCurvature = Infinity
            let margin = Infinity
            const h = 0.5
            for (let z = h; z < L - h; z += 0.5) {
              const [x, y] = spineOffset(spec.branch, L, z)
              maxOff = Math.max(maxOff, Math.hypot(x, y))
              const a = spineOffset(spec.branch, L, z - h)
              const b = spineOffset(spec.branch, L, z + h)
              const k = Math.hypot((a[0] - 2 * x + b[0]) / h ** 2, (a[1] - 2 * y + b[1]) / h ** 2)
              const R = 1 / Math.max(k, 1e-12)
              minRadiusOfCurvature = Math.min(minRadiusOfCurvature, R)
              // Inside of the bend folds over when the wand is thicker than the bend is tight.
              margin = Math.min(margin, R / (spec.profile(z) * 1.3 + 3))
            }
            const tip = spineFrame(spec, L)
            const tipAngle = (Math.acos(tip.t[2]!) * 180) / Math.PI
            worstMargin = Math.min(worstMargin, margin)
            if (seed === 0)
              rows.push(
                `L=${lengthCm} bend=${bend} wiggle=${wiggle}: max offset ${maxOff.toFixed(1)}mm, ` +
                  `tightest bend R=${minRadiusOfCurvature.toFixed(0)}mm, margin ${margin.toFixed(1)}x, ` +
                  `tip leans ${tipAngle.toFixed(1)}deg`,
              )
          }
    process.stderr.write("\n" + rows.join('\n') + `\nworst fold margin over 25 seeds: ${worstMargin.toFixed(2)}x`)
    expect(worstMargin).toBeGreaterThan(1)
  })

  it("bent meshes are finite and keep their ends on the axis", { timeout: 60000 }, () => {
    for (let s = 0; s < 30; s++) {
      const p = { ...randomise(wandSchema, seededRandom(s)), kind: 'branch', bend: 1, wiggle: 1 }
      const spec = compileWand(normalise(wandSchema, p))
      const m = buildWandMesh(spec, { segments: 64, stepMm: 2 })
      for (const v of m.positions) expect(Number.isFinite(v)).toBe(true)
      for (const v of m.normals) expect(Number.isFinite(v)).toBe(true)
      const last = m.positions.length - 3
      expect(Math.hypot(m.positions[0]!, m.positions[1]!)).toBeLessThan(1e-6)
      expect(Math.hypot(m.positions[last]!, m.positions[last + 1]!)).toBeLessThan(1e-6)
    }
  })

  it('times a full-resolution build', () => {
    const spec = compileWand(branch({ bend: 1, wiggle: 1, gnarl: 1, knots: 7 }))
    const straight = compileWand(defaults(wandSchema))
    const t0 = performance.now()
    buildWandMesh(straight)
    const t1 = performance.now()
    buildWandMesh(spec)
    const t2 = performance.now()
    process.stderr.write("\n" + `straight ${(t1 - t0).toFixed(0)}ms, branch ${(t2 - t1).toFixed(0)}ms`)
  })
})
