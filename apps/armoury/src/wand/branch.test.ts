import { describe, expect, it } from 'vitest'

import { defaults, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { buildWandMesh, endPoses, gemPoses, radiusAt, reachMm, spineFrame } from './geometry.ts'
import { wandSchema } from './wandSchema.ts'

const branch = (extra: Record<string, unknown> = {}) =>
  normalise(wandSchema, { ...defaults(wandSchema), kind: 'branch', ...extra })

const randomBranches = Array.from({ length: 12 }, (_, i) => ({
  name: `random branch ${i}`,
  params: normalise(wandSchema, {
    ...randomise(wandSchema, seededRandom(500 + i)),
    kind: 'branch',
    bend: 1,
    wiggle: 1,
    gnarl: 1,
    knots: 6,
    tipGem: 'none',
    endGem: 'none',
  }),
}))

/** Furthest any vertex strays from the straight line between the wand's two ends, mm. */
const furthestFromAxis = (positions: Float32Array) => {
  let far = 0
  for (let k = 0; k < positions.length; k += 3)
    far = Math.max(far, Math.hypot(positions[k]!, positions[k + 1]!))
  return far
}

describe('branch wands', () => {
  it.each(randomBranches)('$name is sealed, finite, and ends on the axis', ({ params }) => {
    const mesh = buildWandMesh(compileWand(params), { segments: 48, stepMm: 1 })
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

  it('bends sideways by up to about 7% of its length', () => {
    const bent = compileWand(branch({ lengthCm: 38, bend: 1, wiggle: 0, thickness: 0.85 }))
    const straight = compileWand(branch({ lengthCm: 38, bend: 0, wiggle: 0, thickness: 0.85 }))
    const reach = (spec: typeof bent) =>
      furthestFromAxis(buildWandMesh(spec, { segments: 48, stepMm: 1 }).positions)
    expect(reach(straight)).toBeLessThan(straight.handleMaxR * 1.2)
    expect(reach(bent) - reach(straight)).toBeGreaterThan(0.04 * 380)
    expect(reach(bent) - reach(straight)).toBeLessThan(0.08 * 380)
  })

  it('never bends tighter than about twice its own radius, so the inside of a bend cannot fold', () => {
    let worst = Infinity
    for (const lengthCm of [28, 33, 38])
      for (const thickness of [0.85, 1.15])
        for (const bend of [0, 0.5, 1])
          for (const wiggle of [0, 0.5, 1])
            for (let branchSeed = 0; branchSeed < 100; branchSeed += 9) {
              const spec = compileWand(
                branch({ lengthCm, thickness, bend, wiggle, branchSeed, gnarl: 1, knots: 6 }),
              )
              const h = 0.5
              for (let z = h; z < spec.lengthMm - h; z += 1) {
                const [a, p, b] = [z - h, z, z + h].map((at) => spineFrame(spec, at).point)
                const curvature = Math.hypot(
                  ...[0, 1, 2].map((i) => (a![i]! - 2 * p![i]! + b![i]!) / h ** 2),
                )
                const bendRadius = 1 / Math.max(curvature, 1e-12)
                if (bendRadius > 60) continue
                let widest = 0
                for (let t = 0; t < Math.PI * 2; t += 0.2)
                  widest = Math.max(widest, radiusAt(spec, t, z).r)
                worst = Math.min(worst, bendRadius / widest)
              }
            }
    expect(worst).toBeGreaterThan(2)
  })

  it('the same params grow the same branch, and only "Which branch" grows another', () => {
    const shape = (extra: Record<string, unknown>) =>
      buildWandMesh(compileWand(branch(extra)), { segments: 32, stepMm: 2 }).positions
    expect(shape({ branchSeed: 7 })).toEqual(shape({ branchSeed: 7 }))
    expect(
      shape({ branchSeed: 7, wood: 'walnut', stainColour: 'midnight', core: 'moonstone' }),
    ).toEqual(shape({ branchSeed: 7 }))
    expect(shape({ branchSeed: 8 })).not.toEqual(shape({ branchSeed: 7 }))
  })

  it('a turned wand stays straight and smooth whatever its branch settings say', () => {
    const turned = (extra: Record<string, unknown>) =>
      buildWandMesh(compileWand(normalise(wandSchema, { kind: 'turned', ...extra })), {
        segments: 32,
        stepMm: 2,
      })
    const plain = turned({})
    const wild = turned({ bend: 1, wiggle: 1, gnarl: 1, knots: 6, branchSeed: 42 })
    expect(wild.positions).toEqual(plain.positions)
    expect(wild.stain).toEqual(plain.stain)
  })

  it('has no shaft carving; a grown handle has no ring or handle pattern either', () => {
    const carved = { shaftCarving: 'longSpiral', handleStyle: 'gemcut', handleCarving: 'diamonds' }
    const grown = compileWand(branch({ ...carved, branchHandle: 'grown' }))
    expect(grown.grooves).toEqual([])
    const turned = compileWand(branch({ ...carved, branchHandle: 'turned' }))
    expect(turned.grooves.length).toBeGreaterThan(0)
    expect(turned.grooves.every((g) => g.to <= turned.handleMm)).toBe(true)
  })

  it('a turned handle on a branch is the same turned handle as on a turned wand', () => {
    const handle = { handleStyle: 'ringed', collarStyle: 'ringStack', endShape: 'knob' }
    const onBranch = compileWand(branch({ ...handle, branchHandle: 'turned' }))
    const onTurned = compileWand(normalise(wandSchema, { ...defaults(wandSchema), ...handle }))
    for (let z = 0; z < onTurned.handleMm; z += 0.5)
      expect(onBranch.profile(z)).toBeCloseTo(onTurned.profile(z), 6)
  })

  it('gems, the crystal and the orb ride the bend with the wood they sit on', () => {
    for (const gems of ['ring', 'line', 'spiral']) {
      const spec = compileWand(
        branch({ bend: 1, wiggle: 1, gems, gemCount: 7, tipGem: 'crystal', endGem: 'orb' }),
      )
      const mesh = buildWandMesh(spec, { segments: 128, stepMm: 0.5 })
      const nearest = (q: number[]) => {
        let best = Infinity
        for (let k = 0; k < mesh.positions.length; k += 3)
          best = Math.min(
            best,
            Math.hypot(
              mesh.positions[k]! - q[0]!,
              mesh.positions[k + 1]! - q[1]!,
              mesh.positions[k + 2]! - q[2]!,
            ),
          )
        return best
      }
      for (const pose of gemPoses(spec)) expect(nearest(pose.position)).toBeLessThan(1)
      // The crystal stands in its cup, its base sunk to the middle of the last ring.
      const { crystal, orb } = endPoses(spec)
      const seat = spec.bodyTo - spec.crystal!.from
      const sunk = crystal!.position.map((v, i) => v + crystal!.direction[i]! * seat)
      const lastRing = mesh.rings * (mesh.segments + 1) * 3
      const cupMiddle = [0, 1, 2].map((i) => mesh.positions[lastRing + i]!)
      expect(Math.hypot(...sunk.map((v, i) => v - cupMiddle[i]!))).toBeLessThan(0.25)
      // The orb's centre is in line with the butt, a radius out from where the body starts.
      const butt = spineFrame(spec, spec.bodyFrom)
      const back = butt.point.map(
        (v, i) => v - butt.tangent[i]! * (spec.bodyFrom - spec.orb!.centre),
      )
      expect(Math.hypot(...orb!.position.map((v, i) => v - back[i]!))).toBeLessThan(0.2)
    }
  })

  it('reaches no further from its axis than the close look allows for', () => {
    for (const bend of [0, 1]) {
      const spec = compileWand(branch({ lengthCm: 38, thickness: 0.85, bend, wiggle: 1 }))
      const mesh = buildWandMesh(spec, { segments: 48, stepMm: 1 })
      expect(furthestFromAxis(mesh.positions)).toBeLessThanOrEqual(reachMm(spec))
    }
    const bowed = compileWand(branch({ lengthCm: 38, thickness: 0.85, bend: 1, wiggle: 0 }))
    expect(reachMm(bowed)).toBeGreaterThan(28.4)
  })
})
