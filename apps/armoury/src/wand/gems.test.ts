import { describe, expect, it } from 'vitest'

import { isVisible, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { SHOWN_SIDE } from './gems.ts'
import { buildWandMesh, gemPoses, radiusAt } from './geometry.ts'
import { wandPresets } from './presets.ts'
import { wandSchema } from './wandSchema.ts'

const preset = (name: string) => {
  const found = wandPresets.find((p) => p.name === name)
  if (!found) throw new Error(`no preset ${name}`)
  return normalise(wandSchema, found.params)
}

const wand = (extra: Record<string, unknown>, base = 'Midnight') =>
  compileWand(normalise(wandSchema, { ...preset(base), ...extra }))

type Spec = ReturnType<typeof compileWand>
type Gem = Spec['gems'][number]

const PATTERNS = ['ring', 'line', 'spiral'] as const
const TAU = Math.PI * 2
const RIM = 0.6

const angleBetween = (a: number, b: number) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI

/** Distance between two gems' centres over the wand's surface, mm. */
const apart = (spec: Spec, a: Gem, b: Gem) =>
  Math.hypot(spec.profile((a.z + b.z) / 2) * angleBetween(a.theta, b.theta), a.z - b.z)

const busy = {
  gemCount: 9,
  gemSize: 1,
  nodes: 'knobs',
  nodeCount: 5,
  nodeSize: 1,
  bands: 'three',
}

describe('set gems', () => {
  it('a wand saved before gems opens with none', () => {
    const spec = compileWand(preset('Midnight'))
    expect(spec.gems).toEqual([])
    expect(spec.crystal).toBeNull()
    expect(spec.orb).toBeNull()
  })

  it.each(PATTERNS)('%s places as many gems as asked for, the same way every time', (gems) => {
    for (const gemCount of [3, 5, 9]) {
      const spec = wand({ gems, gemCount })
      expect(spec.gems).toHaveLength(gemCount)
      expect(wand({ gems, gemCount }).gems).toEqual(spec.gems)
    }
  })

  it.each(PATTERNS)('%s gems sit on the surface, facing out, without touching', (gems) => {
    const crowded = { lengthCm: 28, nodeCount: 7, bands: 'three', gemCount: 9, gemSize: 1 }
    for (const extra of [
      {},
      busy,
      { lengthCm: 28, pointy: 1, thickness: 0.85, gemCount: 9 },
      { ...crowded, nodes: 'knobs' },
      { ...crowded, nodes: 'knobs', tipGem: 'crystal' },
      { ...crowded, nodes: 'rings', tipGem: 'crystal' },
    ]) {
      const spec = wand({ gems, ...extra })
      const poses = gemPoses(spec)
      expect(poses).toHaveLength(spec.gems.length)
      for (const [i, { position, normal }] of poses.entries()) {
        const [x, y, z] = position
        expect(Math.hypot(x, y)).toBeCloseTo(spec.profile(z), 6)
        expect(Math.hypot(...normal)).toBeCloseTo(1, 6)
        expect((normal[0] * x + normal[1] * y) / Math.hypot(x, y)).toBeGreaterThan(0.9)
        expect(spec.gems[i]!.radius).toBeLessThanOrEqual(0.4 * spec.profile(z) + 1e-9)
      }
      for (const [i, a] of spec.gems.entries()) {
        for (const b of spec.gems.slice(i + 1)) {
          expect(apart(spec, a, b)).toBeGreaterThan(a.radius + b.radius + 2 * RIM)
        }
      }
    }
  })

  it('a ring goes round the handle, evenly and clear of its beads', () => {
    for (const handleStyle of ['plain', 'ringed', 'spiral', 'gemcut']) {
      const spec = wand({ gems: 'ring', handleStyle, gemSize: 1 })
      const bare = wand({ handleStyle })
      for (const gem of spec.gems) {
        expect(gem.z).toBeLessThan(spec.handleMm)
        // The handle's outline is smooth under the seat and rim: no bead there.
        const reach = gem.radius + RIM
        const bend =
          bare.profile(gem.z - reach) + bare.profile(gem.z + reach) - 2 * bare.profile(gem.z)
        expect(Math.abs(bend)).toBeLessThan(0.3)
      }
      const turns = spec.gems.map((g) => g.theta).sort((a, b) => a - b)
      const gaps = turns.slice(1).map((t, i) => t - turns[i]!)
      for (const gap of gaps) expect(gap).toBeCloseTo(TAU / spec.gems.length, 6)
    }
  })

  it.each(['line', 'spiral'])('%s gems go up the lower shaft, between bands and bumps', (gems) => {
    const spec = wand({ gems, ...busy })
    const bands = spec.zones.filter((z) => z.uncarved)
    const smooth = wand({ ...busy, nodes: 'none', bands: 'none' })
    expect(bands.length).toBeGreaterThan(0)
    for (const gem of spec.gems) {
      expect(gem.z).toBeGreaterThan(spec.handleMm + 10)
      expect(gem.z).toBeLessThan(spec.lengthMm * 0.75)
      for (const band of bands) {
        expect(gem.z + gem.radius < band.from || gem.z - gem.radius > band.to).toBe(true)
      }
      // Not on a bump's crest, where the shaft swells.
      expect(spec.profile(gem.z) / smooth.profile(gem.z) - 1).toBeLessThan(0.1)
    }
  })

  it.each(['cut', 'raised'])('a spiral of gems winds between a %s spiral, not on it', (style) => {
    const spec = wand({
      gems: 'spiral',
      shaftCarving: 'longSpiral',
      shaftReach: 0.85,
      spiralStyle: style,
    })
    const set = spec.grooves.find((g) => g.from >= spec.handleMm)!
    const spacing = TAU / set.count
    for (const gem of spec.gems) {
      const phase = gem.theta - TAU * set.twist * (gem.z - set.from)
      const fromGroove = Math.abs(angleBetween(phase, Math.round(phase / spacing) * spacing))
      expect(fromGroove).toBeCloseTo(spacing / 2, 6)
    }
  })

  it('with no carving to follow, a spiral of gems winds gently, so most face one side', () => {
    for (const lengthCm of [28, 38]) {
      const spec = wand({ gems: 'spiral', shaftCarving: 'none', gemCount: 9, lengthCm })
      const turned = spec.gems[spec.gems.length - 1]!.theta - spec.gems[0]!.theta
      expect(Math.abs(turned)).toBeGreaterThan(Math.PI / 2)
      expect(Math.abs(turned)).toBeLessThan(1.5 * Math.PI)
      const facing = spec.gems.filter(
        (g) => Math.abs(angleBetween(g.theta, SHOWN_SIDE)) < Math.PI / 2,
      )
      expect(facing.length).toBeGreaterThanOrEqual(7)
    }
  })

  it.each(PATTERNS)("carving and raised spirals stop at a %s of gems' settings", (gems) => {
    for (const spiralStyle of ['cut', 'raised']) {
      const spec = wand({
        gems,
        spiralStyle,
        shaftCarving: 'longSpiral',
        shaftReach: 0.85,
        shaftGrooves: 3,
        shaftGrooveWidth: 1,
        handleCarving: 'flutes',
      })
      const plain = wand({ gems, shaftCarving: 'none', handleCarving: 'none' })
      for (const gem of spec.gems) {
        for (let a = 0; a < TAU; a += 0.5) {
          for (const d of [0, gem.radius * 0.5, gem.radius + RIM]) {
            const theta = gem.theta + (d * Math.cos(a)) / spec.profile(gem.z)
            const z = gem.z + d * Math.sin(a)
            const { r, r0 } = radiusAt(spec, theta, z)
            const bare = radiusAt({ ...plain, gems: spec.gems }, theta, z)
            expect(r - r0).toBeCloseTo(bare.r - bare.r0, 4)
          }
        }
      }
    }
  })

  it("settings are the wand's metal when it has some, else the wood they are cut in", () => {
    const metalAt = (spec: Spec) =>
      Math.min(...spec.gems.map((g) => radiusAt(spec, g.theta, g.z + g.radius + 0.3).metal))
    expect(metalAt(wand({ gems: 'line' }))).toBe(0)
    expect(metalAt(wand({ gems: 'line', bands: 'one' }))).toBe(1)
  })

  it('a seat is a shallow cut with a low rim, inside the envelope', () => {
    const spec = wand({ gems: 'ring', gemSize: 1 })
    const gem = spec.gems[0]!
    const at = (d: number) => {
      const { r, r0 } = radiusAt(spec, gem.theta, gem.z + d)
      return (r - r0) / r0
    }
    expect(at(0)).toBeLessThan(0)
    expect(at(0)).toBeGreaterThan(-0.25)
    expect(at(gem.radius + RIM / 2)).toBeGreaterThan(0)
  })
})

describe('end gems', () => {
  it('a crystal tip replaces the end of the shaft, so the wand is no longer', () => {
    const plain = wand({})
    const spec = wand({ tipGem: 'crystal' })
    expect(spec.lengthMm).toBe(plain.lengthMm)
    const crystal = spec.crystal!
    expect(crystal.from).toBeLessThan(spec.bodyTo)
    expect(spec.bodyTo).toBeLessThan(spec.lengthMm)
    expect(spec.profile(spec.bodyTo)).toBe(0)
    // The cup it stands in is a little wider than the crystal.
    expect(spec.profile(spec.bodyTo - 3)).toBeGreaterThan(crystal.radius)
    expect(crystal.radius).toBeLessThan(spec.handleMaxR)
    // Long enough to read as a crystal, short enough to stay a tip.
    expect(spec.lengthMm - crystal.from).toBeGreaterThan(15)
    expect(spec.lengthMm - crystal.from).toBeLessThan(0.12 * spec.lengthMm)
  })

  it('an orb replaces the end, sitting in a socket at the pommel', () => {
    const spec = wand({ endGem: 'orb' })
    const orb = spec.orb!
    expect(orb.centre - orb.radius).toBe(0)
    expect(orb.radius).toBeLessThan(spec.handleMaxR)
    expect(spec.bodyFrom).toBeGreaterThan(orb.centre)
    expect(spec.bodyFrom).toBeLessThan(orb.centre + orb.radius)
    // The socket is wider than the orb where the wood starts, so the orb sits in it.
    const crossSection = Math.sqrt(orb.radius ** 2 - (spec.bodyFrom + 1 - orb.centre) ** 2)
    expect(spec.profile(spec.bodyFrom + 1)).toBeGreaterThan(crossSection)
  })

  it.each([{ tipGem: 'crystal' }, { endGem: 'orb' }, { tipGem: 'crystal', endGem: 'orb' }])(
    'the body is a closed mesh between the end gems: %o',
    (extra) => {
      const spec = wand({ ...extra, gems: 'spiral', handleCarving: 'flutes' })
      const mesh = buildWandMesh(spec, { segments: 32, stepMm: 1 })
      expect(mesh.positions.every(Number.isFinite)).toBe(true)
      const cols = mesh.segments + 1
      for (const j of [0, mesh.rings]) {
        for (let i = 0; i < cols; i++) {
          const k = (j * cols + i) * 3
          expect(Math.hypot(mesh.positions[k]!, mesh.positions[k + 1]!)).toBeLessThan(1e-6)
        }
      }
      expect(mesh.positions[2]).toBeCloseTo(spec.bodyFrom, 3)
      expect(mesh.positions[mesh.rings * cols * 3 + 2]).toBeCloseTo(spec.bodyTo, 3)
    },
  )

  it("the crystal's cup is metal when the wand has metal", () => {
    const cupOf = (extra: Record<string, unknown>) => {
      const spec = wand({ tipGem: 'crystal', ...extra })
      return spec.zones.some((z) => z.material === 'metal' && z.to === spec.bodyTo)
    }
    expect(cupOf({})).toBe(false)
    expect(cupOf({ endCap: 'metal' })).toBe(true)
  })

  it('hide the tip and end shapes they replace', () => {
    const shown = (key: string, extra: Record<string, unknown>) =>
      isVisible(
        wandSchema.params.find((d) => d.key === key)!,
        normalise(wandSchema, extra),
      )
    expect(shown('tipShape', {})).toBe(true)
    expect(shown('tipShape', { tipGem: 'crystal' })).toBe(false)
    expect(shown('endShape', {})).toBe(true)
    expect(shown('endShape', { endGem: 'orb' })).toBe(false)
  })
})

describe('gems in try another', () => {
  it('turn up as an occasional treat, about one wand in ten', () => {
    const rng = seededRandom(5)
    const rolls = Array.from({ length: 3000 }, () => compileWand(randomise(wandSchema, rng)))
    const share = rolls.filter((s) => s.gems.length > 0 || s.crystal || s.orb).length / 3000
    expect(share).toBeGreaterThan(0.06)
    expect(share).toBeLessThan(0.15)
  })
})

describe('the presets', () => {
  it('include a wand with set gems and an end gem', () => {
    const jewelled = wandPresets.filter((p) => {
      const spec = compileWand(normalise(wandSchema, p.params))
      return spec.gems.length > 0 && (spec.crystal ?? spec.orb)
    })
    expect(jewelled.length).toBeGreaterThan(0)
  })
})
