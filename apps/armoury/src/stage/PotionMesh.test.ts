import * as THREE from 'three'
import { describe, expect, test, vi } from 'vitest'

import { defaults, type Params } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from '../potion/bottles.ts'
import { compilePotion } from '../potion/compile.ts'
import { BASE_LINE, TALLEST_MM } from '../potion/framing.ts'
import { buildPotionMesh } from '../potion/geometry.ts'
import { uprightLevels } from '../potion/profile.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import { levelsAt, levelTable } from '../potion/tipped.ts'
import { boxCameraPosition } from './boxRig.tsx'
import { fillGeometries, liquidLevels, RENDER_ORDER } from './PotionMesh.tsx'
import { boxCentreY, boxScale, POTION_HALF_WIDTH } from './potionScene.tsx'
import { FOV, MM } from './scene.tsx'

const potion = (values: Params) => compilePotion({ ...defaults(potionSchema), ...values })
const SHAPES = Object.keys(BOTTLES) as ShapeId[]

describe("the potion's buffers", () => {
  test('a catalogue potion gives the glass, the liquid, the stopper and the label, with the attributes the shaders read', () => {
    const g = fillGeometries(null, buildPotionMesh(potion({ label: 'banner' })))
    for (const part of [g.glass, g.liquid, g.stopper, g.label!])
      for (const name of ['position', 'normal', 'uv', 'aHeight'])
        expect(part.getAttribute(name), name).toBeDefined()
    expect(g.liquid.getIndex()!.count).toBeGreaterThan(0)
    expect(fillGeometries(null, buildPotionMesh(potion({ label: 'none' }))).label).toBeNull()
  })

  test('draws the glass back, the liquid, the particles and the glass front in that order', () => {
    const { glassBack, liquid, particles, glassFront } = RENDER_ORDER
    expect([glassBack, liquid, particles, glassFront]).toEqual(
      [glassBack, liquid, particles, glassFront].sort((a, b) => a - b),
    )
    expect(new Set([glassBack, liquid, particles, glassFront]).size).toBe(4)
  })

  test('a respec of the same sizes refills the buffers it has and allocates none', () => {
    const before = fillGeometries(
      null,
      buildPotionMesh(potion({ ...withPours(['moonmilk', 'rosehip', 'starpetal']) })),
    )
    const attributes = (g: typeof before) =>
      [g.glass, g.liquid, g.stopper, g.label!].flatMap((p) => [
        p,
        p.getIndex(),
        ...Object.values(p.attributes),
      ])
    const held = attributes(before)
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
    const fewer = buildPotionMesh(potion({ ...withPours(['bluebell']), glass: 'amber' }))
    const after = fillGeometries(before, fewer)
    expect(attributes(after)).toHaveLength(held.length)
    attributes(after).forEach((a, i) => expect(a).toBe(held[i]))
    expect(dispose).not.toHaveBeenCalled()
    expect(Array.from(after.liquid.getAttribute('position').array)).toEqual(
      Array.from(fewer.liquid.positions),
    )

    const taller = fillGeometries(after, buildPotionMesh(potion({ shape: 'tall' })))
    expect(taller.glass).not.toBe(before.glass)
    expect(dispose).toHaveBeenCalled()
    dispose.mockRestore()
  })
})

describe("the liquid's band tops", () => {
  const spec = potion({ shape: 'round', ...withPours(['moonmilk', 'rosehip', 'starpetal']) })
  const table = levelTable(spec)
  const upright = uprightLevels(spec)

  test('upright, they are the upright levels and need no table', () => {
    const build = vi.fn(() => table)
    expect(liquidLevels(new THREE.Vector3(0, 0, 1), upright, build)).toEqual(upright)
    expect(build).not.toHaveBeenCalled()
  })

  test("tipped either way, they keep each band's volume at that tilt", () => {
    const tilt = (30 * Math.PI) / 180
    const u = new THREE.Vector3(Math.sin(tilt), 0, Math.cos(tilt))
    const expected = levelsAt(table, tilt)
    liquidLevels(u, upright, () => table).forEach((h, i) => expect(h).toBeCloseTo(expected[i]!, 9))
    const other = new THREE.Vector3(0, -Math.sin(tilt), Math.cos(tilt))
    liquidLevels(other, upright, () => table).forEach((h, i) =>
      expect(h).toBeCloseTo(expected[i]!, 9),
    )
  })
})

describe('the potion on its box stage', () => {
  // The stage slot is square, so its camera is framed for an aspect of 1.
  const camera = (halfWidth: number) => {
    const c = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
    boxCameraPosition('front', halfWidth, 1, c.position)
    c.lookAt(0, 0, 0)
    c.updateMatrixWorld()
    return c
  }
  /** How far down the stage `y` (the box's world) is drawn, from 0 at the top to 1 at the bottom. */
  const down = (y: number) =>
    (1 - new THREE.Vector3(0, y, 0).project(camera(POTION_HALF_WIDTH)).y) / 2

  for (const shape of SHAPES)
    for (const neck of [0, 1])
      test(`stands the ${shape} bottle at neck ${neck} with its foot on the base line`, () => {
        const spec = potion({ shape, neck })
        const scale = boxScale(spec)
        const foot = (boxCentreY(spec) - (spec.heightMm * MM) / 2) * scale
        expect(down(foot)).toBeCloseTo(BASE_LINE, 9)
      })

  test('fits the tallest bottle with room above its stopper', () => {
    const tallest = SHAPES.map((shape) => potion({ shape, neck: 1 })).find(
      (s) => s.heightMm === TALLEST_MM,
    )!
    const top = (boxCentreY(tallest) + (tallest.heightMm * MM) / 2) * boxScale(tallest)
    expect(down(top)).toBeGreaterThan(0.05)
    expect(down(top)).toBeLessThan(0.15)
  })
})
