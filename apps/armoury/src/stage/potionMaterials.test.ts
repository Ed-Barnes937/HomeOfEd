import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { compilePotion } from '../potion/compile.ts'
import { buildPotionMesh } from '../potion/geometry.ts'
import { bottleProfile } from '../potion/profile.ts'
import { MAX_POURS, potionSchema } from '../potion/potionSchema.ts'
import { normalise } from '../engine/schema.ts'
import { withPours } from '../potion/pours.ts'
import { tagLayout } from '../potion/geometry.ts'
import { BLOOM_THRESHOLD } from './stage.ts'
import {
  bandEdges,
  createLiquid,
  freezeFrom,
  GLASS_LOOKS,
  LABEL_LOOKS,
  labelLines,
  LiquidClock,
  PAPERS,
  paperMask,
  REST_CAP,
  RESTING_EMISSIVE,
  softCap,
  STOPPER_LOOKS,
} from './potionMaterials.ts'

const optionsOf = (key: string) => {
  const param = potionSchema.params.find((p) => p.key === key)
  if (param?.kind !== 'choice') throw new Error(`${key} is not a choice`)
  return param.options.map((o) => o.value)
}

const inUnit = (n: number) => n >= 0 && n <= 1
const rgbInUnit = (c: readonly number[]) => c.length === 3 && c.every(inUnit)

describe('potion material tables', () => {
  it('has a glass row for every glass, its colours linear and in range', () => {
    for (const value of optionsOf('glass')) {
      const row = GLASS_LOOKS[value as keyof typeof GLASS_LOOKS]
      expect(row, value).toBeDefined()
      for (const c of [row.through, row.edge, row.rim, row.body])
        expect(rgbInUnit(c), value).toBe(true)
      expect(inUnit(row.alpha) && inUnit(row.edgeAlpha) && inUnit(row.roughness), value).toBe(true)
    }
  })

  it('lets clear glass through nearly untouched and tints the others', () => {
    expect(Math.min(...GLASS_LOOKS.clear.through)).toBeGreaterThan(0.9)
    for (const tint of ['sea', 'amber', 'violet', 'smoky'] as const) {
      const [r, g, b] = GLASS_LOOKS[tint].through
      expect(Math.max(r, g, b) - Math.min(r, g, b) > 0.05 || tint === 'smoky', tint).toBe(true)
      expect(Math.min(r, g, b), tint).toBeGreaterThan(0.25)
    }
  })

  it('has a stopper row for every stopper', () => {
    for (const value of optionsOf('stopper')) {
      const row = STOPPER_LOOKS[value as keyof typeof STOPPER_LOOKS]
      expect(row, value).toBeDefined()
      expect(inUnit(row.roughness), value).toBe(true)
      if (row.colour) expect(rgbInUnit(row.colour), value).toBe(true)
    }
    expect(STOPPER_LOOKS.wax.roughness).toBeLessThan(STOPPER_LOOKS.cork.roughness)
  })

  it('has a label row for every label, none drawing nothing', () => {
    for (const value of optionsOf('label')) expect(value in LABEL_LOOKS, value).toBe(true)
    expect(LABEL_LOOKS.none).toBeNull()
    for (const value of ['round', 'banner', 'tag'] as const)
      expect(LABEL_LOOKS[value]!.maxLines, value).toBeGreaterThan(0)
  })

  it('has plain and gold paper, linear and in range', () => {
    for (const paper of [PAPERS.plain, PAPERS.gold]) {
      expect(rgbInUnit(paper.emissive)).toBe(true)
      for (const hex of [paper.paper, paper.shade, paper.ink]) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('the bloom cap at rest', () => {
  it('is 0.92 of the bloom threshold', () => {
    expect(REST_CAP).toBeCloseTo(0.92 * BLOOM_THRESHOLD)
  })

  it('rolls everything off below the cap', () => {
    for (const v of [0, 0.5, 1, 1.3, 2, 10, 1e6]) expect(softCap(v)).toBeLessThan(REST_CAP)
    expect(softCap(0.3)).toBe(0.3)
  })

  it('keeps every resting emissive under the cap before the soft knee', () => {
    for (const [name, value] of Object.entries(RESTING_EMISSIVE))
      expect(value, name).toBeLessThan(REST_CAP)
  })
})

describe('soft band edges', () => {
  it('blend each boundary over a tenth of its thinner neighbour, within bounds', () => {
    const edges = bandEdges([20, 50, 90], 5)
    expect(edges).toHaveLength(2)
    expect(edges[0]).toBeCloseTo(0.08 * 15)
    expect(edges[1]).toBeCloseTo(0.08 * 30)
    expect(bandEdges([6, 6.2, 70], 5)[0]).toBeGreaterThan(0)
    expect(Math.max(...bandEdges([200, 400, 600], 0))).toBeLessThanOrEqual(4)
  })
})

describe('the liquid', () => {
  it('writes its surface into its uniforms', () => {
    const liquid = createLiquid()
    const before = liquid.uniforms.uLevels
    liquid.setSurface(new THREE.Vector3(0, 0.6, 0.8), [12, 30, 44])
    expect(liquid.uniforms.uUp.value.toArray()).toEqual([0, 0.6, 0.8])
    expect(liquid.uniforms.uLevels.value).toEqual([12, 30, 44])
    expect(liquid.uniforms.uCount.value).toBe(3)
    expect(liquid.uniforms.uEdges.value).toEqual(
      bandEdges([12, 30, 44], liquid.uniforms.uFloor.value),
    )
    liquid.setSurface(new THREE.Vector3(0, 0, 1), [18])
    expect(liquid.uniforms.uCount.value).toBe(1)
    expect(liquid.uniforms.uLevels).toBe(before)
    liquid.dispose()
  })

  it('keeps at most MAX_POURS levels', () => {
    const liquid = createLiquid()
    liquid.setSurface(new THREE.Vector3(0, 0, 1), [1, 2, 3, 4, 5])
    expect(liquid.uniforms.uCount.value).toBe(MAX_POURS)
    expect(liquid.uniforms.uLevels.value).toHaveLength(MAX_POURS)
    liquid.dispose()
  })

  it('draws every band as clear or cloud', () => {
    const liquid = createLiquid()
    liquid.setLayers([
      { colour: '#ece6f4', trait: 'cloud' },
      { colour: '#d9467a', trait: 'swirl' },
      { colour: '#f2c14e', trait: 'glitter' },
    ])
    expect(liquid.uniforms.uCloud.value).toEqual([1, 0, 0])
    for (const c of liquid.uniforms.uColour.value) expect(rgbInUnit(c.toArray())).toBe(true)
    liquid.dispose()
  })
})

describe('the liquid clock', () => {
  it('runs with the frames', () => {
    const clock = new LiquidClock({ frozenAt: null, still: false })
    clock.tick(0.5)
    clock.tick(0.25)
    expect(clock.time).toBeCloseTo(0.75)
  })

  it('does not advance under reduced motion', () => {
    const clock = new LiquidClock({ frozenAt: null, still: true })
    clock.tick(0.5)
    expect(clock.time).toBe(0)
  })

  it('holds a frozen moment', () => {
    const clock = new LiquidClock({ frozenAt: 1.2, still: false })
    clock.tick(0.5)
    expect(clock.time).toBe(1.2)
  })

  it('reads ?freeze only on a dev server', () => {
    expect(freezeFrom('?freeze=1.2', true)).toBe(1.2)
    expect(freezeFrom('?clay&freeze=0', true)).toBe(0)
    expect(freezeFrom('?freeze=1.2', false)).toBeNull()
    expect(freezeFrom('', true)).toBeNull()
    expect(freezeFrom('?freeze=soon', true)).toBeNull()
  })
})

describe('label ink', () => {
  it('splits a name into balanced lines', () => {
    expect(labelLines('Moonmilk, Rosehip and Starpetal', 3)).toEqual([
      'Moonmilk,',
      'Rosehip and',
      'Starpetal',
    ])
    expect(labelLines('Moonmilk, Rosehip and Starpetal', 2)).toEqual([
      'Moonmilk, Rosehip',
      'and Starpetal',
    ])
    expect(labelLines('Pure Moonmilk', 3)).toEqual(['Pure', 'Moonmilk'])
    expect(labelLines('Puffcap', 3)).toEqual(['Puffcap'])
  })

  it('marks a tag card as paper and its string as not', () => {
    const spec = compilePotion(
      normalise(potionSchema, { ...withPours(['moonmilk']), shape: 'teardrop', label: 'tag' }),
    )
    const label = buildPotionMesh(spec).label!
    const mask = paperMask(label, true)
    const string = mask.filter((m) => m === 0).length
    expect(string).toBe(tagLayout(bottleProfile(spec)).string.length * 8)
    expect(mask.length - string).toBeGreaterThan(0)
    const round = buildPotionMesh({ ...spec, label: 'round' }).label!
    expect(paperMask(round, false).every((m) => m === 1)).toBe(true)
  })
})
