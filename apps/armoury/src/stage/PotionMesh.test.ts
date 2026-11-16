import * as THREE from 'three'
import { describe, expect, test, vi } from 'vitest'

import { defaults, type Params } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from '../potion/bottles.ts'
import { compilePotion } from '../potion/compile.ts'
import { BASE_LINE, TALLEST_MM } from '../potion/framing.ts'
import { buildPotionMesh } from '../potion/geometry.ts'
import { BASE_MM, LIQUID_GAP_MM, uprightLevels } from '../potion/profile.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import { floorAt, levelsAt, levelTable } from '../potion/tipped.ts'
import { boxCameraPosition } from './boxRig.tsx'
import { CAMERA_DISTANCE, hitGeometry, uprightScale, type HeldItem } from './HeldRig.tsx'
import { LEAN_MARGIN, LEAN_MAX, leanShiftMm } from './hold.ts'
import { potionHeldItem } from './PotionCloseUpStage.tsx'
import {
  fillGeometries,
  liquidLevels,
  liquidTops,
  mixDrawn,
  mixLook,
  poseStopper,
  RENDER_ORDER,
  sameBuild,
  shownSpec,
  surfaceUp,
} from './PotionMesh.tsx'
import { showSeconds } from './potionShow.ts'
import { boxCentreY, POTION_HALF_WIDTH } from './potionScene.tsx'
import { FOV, MM } from './scene.tsx'

const potion = (values: Params) => compilePotion({ ...defaults(potionSchema), ...values })
const SHAPES = Object.keys(BOTTLES) as ShapeId[]

describe("the potion's buffers", () => {
  test('a catalogue potion gives the glass, the liquid, the stopper and the label, with the attributes the shaders read', () => {
    const g = fillGeometries(null, buildPotionMesh(potion({ label: 'banner' })))
    for (const part of [g.glass, g.liquid, g.stopper, g.label!])
      for (const name of ['position', 'normal', 'uv', 'aHeight'])
        expect(part.getAttribute(name), name).toBeDefined()
    for (const part of [g.glass, g.stopper]) expect(part.getAttribute('aInner')).toBeDefined()
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
    const out: number[] = []
    expect(liquidLevels(u, upright, () => table, out)).toBe(out)
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
        const foot = boxCentreY(spec) - (spec.heightMm * MM) / 2
        expect(down(foot)).toBeCloseTo(BASE_LINE, 9)
      })

  test('fits the tallest bottle with room above its stopper', () => {
    const tallest = SHAPES.map((shape) => potion({ shape, neck: 1 })).find(
      (s) => s.heightMm === TALLEST_MM,
    )!
    const top = boxCentreY(tallest) + (tallest.heightMm * MM) / 2
    expect(down(top)).toBeGreaterThan(0.05)
    expect(down(top)).toBeLessThan(0.15)
  })
})

describe("the liquid's up, in the bottle's frame", () => {
  const X = new THREE.Vector3(1, 0, 0)
  const Y = new THREE.Vector3(0, 1, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const DEGREE = Math.PI / 180
  /** The liquid's world turn: the mesh's own quarter turn (axis +z to +y), then leaned in the screen plane. */
  const bottle = (lean: number) =>
    new THREE.Quaternion()
      .setFromAxisAngle(X, -Math.PI / 2)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(Z, -lean))
  const degreesFrom = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) / DEGREE

  test('a bottle standing in an upright frame has the surface square to its axis', () => {
    const u = surfaceUp(new THREE.Vector3(), bottle(0), new THREE.Quaternion())
    expect(degreesFrom(u, Z)).toBeCloseTo(0, 9)
  })

  test('a bottle leaned 30 degrees sees the surface 30 degrees off its axis', () => {
    const u = surfaceUp(new THREE.Vector3(), bottle(30 * DEGREE), new THREE.Quaternion())
    expect(degreesFrom(u, Z)).toBeCloseTo(30, 9)
  })

  test("a 10 degree wobble in the frame's own coordinates comes out 10 degrees off the level", () => {
    const level = surfaceUp(new THREE.Vector3(), bottle(30 * DEGREE), new THREE.Quaternion())
    const wobble = Y.clone().applyAxisAngle(Z, -10 * DEGREE)
    const u = surfaceUp(new THREE.Vector3(), bottle(30 * DEGREE), new THREE.Quaternion(), wobble)
    expect(degreesFrom(u, level)).toBeCloseTo(10, 9)
    expect(degreesFrom(u, Z)).toBeCloseTo(20, 9)
  })

  test("the frame's turn counts, so a bottle turned with its frame stays square to it", () => {
    const pitch = new THREE.Quaternion().setFromAxisAngle(X, 0.3)
    const u = surfaceUp(new THREE.Vector3(), bottle(0).premultiply(pitch), pitch)
    expect(degreesFrom(u, Z)).toBeCloseTo(0, 9)
  })

  test('a normal of any length reads as a direction, and the inputs are left as they were', () => {
    const b = bottle(0.4)
    const before = b.clone()
    const n = new THREE.Vector3(0, 5, 0)
    const u = surfaceUp(new THREE.Vector3(), b, new THREE.Quaternion(), n)
    expect(u.length()).toBeCloseTo(1, 9)
    expect(b.equals(before)).toBe(true)
    expect(n.y).toBe(5)
  })
})

describe('the liquid as it is drawn, on a posed scene graph', () => {
  const DEGREE = Math.PI / 180
  const Z = new THREE.Vector3(0, 0, 1)
  const spec = potion({ shape: 'round', neck: 0.5 })
  const table = levelTable(spec)
  const built = { upright: uprightLevels(spec), floor: BASE_MM + LIQUID_GAP_MM }
  const work = () => ({
    u: new THREE.Vector3(),
    bottle: new THREE.Quaternion(),
    up: new THREE.Quaternion(),
    at: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    levels: [] as number[],
    floor: 0,
    table: () => table,
  })

  /** The rig's up frame pitched by `pitch`, holding the bottle leaned by `lean`; the bottle mesh as PotionMesh nests it. */
  function posed(pitch: number, lean: number) {
    const scene = new THREE.Scene()
    const up = new THREE.Group()
    up.rotation.x = pitch
    const held = new THREE.Group()
    held.rotation.z = -lean
    const inner = new THREE.Group()
    inner.rotation.x = -Math.PI / 2
    inner.scale.setScalar(MM)
    const liquid = new THREE.Mesh()
    inner.add(liquid)
    held.add(inner)
    up.add(held)
    scene.add(up)
    scene.updateMatrixWorld()
    return { liquid, upFrom: { current: up } }
  }

  test('a bottle leaned 30 degrees in its frame draws the bands at the 30 degree levels', () => {
    const { liquid, upFrom } = posed(0, 30 * DEGREE)
    const w = work()
    const tops = liquidTops(liquid, { built, upFrom }, w)
    expect(w.u.angleTo(Z) / DEGREE).toBeCloseTo(30, 6)
    tops.forEach((h, i) => expect(h).toBeCloseTo(levelsAt(table, 30 * DEGREE)[i]!, 6))
    expect(tops).toBe(w.levels)
  })

  test('tipped, the floor is the lowest point along up; upright, the mesh floor', () => {
    const tipped = posed(0, 60 * DEGREE)
    const w = work()
    liquidTops(tipped.liquid, { built, upFrom: tipped.upFrom }, w)
    expect(w.floor).toBeCloseTo(floorAt(table, 60 * DEGREE), 6)
    expect(w.floor).toBeLessThan(built.floor - 20)
    liquidTops(tipped.liquid, { built, upFrom: tipped.upFrom, levels: [40, 50] }, w)
    expect(w.floor).toBeCloseTo(floorAt(table, 60 * DEGREE), 6)
    const upright = posed(0, 0)
    liquidTops(upright.liquid, { built, upFrom: upright.upFrom }, w)
    expect(w.floor).toBe(built.floor)
  })

  test('a 10 degree wobble given as the surface normal comes out 20 degrees off the axis', () => {
    const { liquid, upFrom } = posed(0, 30 * DEGREE)
    const surfaceNormal = new THREE.Vector3(0, 1, 0).applyAxisAngle(Z, -10 * DEGREE)
    const w = work()
    liquidTops(liquid, { built, upFrom, surfaceNormal }, w)
    expect(w.u.angleTo(Z) / DEGREE).toBeCloseTo(20, 6)
  })

  test('a bottle turned with its up frame stays upright, whatever the frame does in the world', () => {
    const { liquid, upFrom } = posed(0.3, 0)
    const w = work()
    expect(liquidTops(liquid, { built, upFrom }, w)).toEqual(built.upright)
    expect(w.u.angleTo(Z) / DEGREE).toBeCloseTo(0, 6)
  })

  test('given levels win over the looked-up ones', () => {
    const { liquid, upFrom } = posed(0, 30 * DEGREE)
    expect(liquidTops(liquid, { built, upFrom, levels: [1, 2] }, work())).toEqual([1, 2])
  })
})

describe('the mixed liquid as it is drawn', () => {
  const three = withPours(['moonmilk', 'rosehip', 'starpetal'])

  test("at rest it is the spec's: its layers, or the mix once mixed, with no vortex", () => {
    expect(mixDrawn(potion({ ...three, mixed: 'no' }))).toEqual({ mix: 0, swirl: 0, spin: 0 })
    expect(mixDrawn(potion({ ...three, mixed: 'yes' }))).toEqual({ mix: 1, swirl: 0, spin: 0 })
    expect(mixDrawn(potion({ ...withPours(['moonmilk']), mixed: 'yes' })).mix).toBe(0)
  })

  test('a show playing wins over the spec, read from its holder as it is drawn', () => {
    const show = { current: { mix: 0.4, swirl: 0.9, spin: 3 } }
    expect(mixDrawn(potion({ ...three, mixed: 'yes' }), show)).toBe(show.current)
    show.current = { mix: 1, swirl: 0, spin: 0 }
    expect(mixDrawn(potion({ ...three, mixed: 'no' }), show)).toBe(show.current)
  })

  test("the mix's look is its colour, its trait and its main ingredient, as soon as three are in", () => {
    const spec = potion({ ...three, mixed: 'no' })
    expect(mixLook(spec)).toEqual({
      colour: spec.mix!.colour,
      trait: spec.mix!.trait,
      ingredient: spec.mix!.main,
    })
    expect(mixLook(potion(withPours(['frogfizz', 'rosehip'])))).toBeNull()
    const murky = potion(withPours(['emberroot', 'snailshine', 'moonmilk']))
    expect(mixLook(murky)).toMatchObject({ trait: 'murk', ingredient: null })
  })
})

describe('the build a spec asks for', () => {
  const three = withPours(['moonmilk', 'rosehip', 'starpetal'])
  const layered = potion({ ...three, mixed: 'no' })

  test('is the same one when only mixed differs, so the reveal rebuilds nothing', () => {
    expect(sameBuild(layered, layered)).toBe(true)
    expect(sameBuild(layered, potion({ ...three, mixed: 'no' }))).toBe(true)
    expect(sameBuild(layered, potion({ ...three, mixed: 'yes' }))).toBe(true)
    expect(sameBuild(potion({ ...three, mixed: 'yes' }), layered)).toBe(true)
  })

  test('is another one when the bottle or what is in it differs', () => {
    const others: Params[] = [
      { ...three, shape: 'gourd' },
      { ...three, neck: 0.9 },
      { ...three, glass: 'sea' },
      { ...three, stopper: 'glass' },
      { ...three, label: 'banner' },
      withPours(['moonmilk', 'rosehip']),
      withPours(['moonmilk', 'rosehip', 'frogfizz']),
      withPours(['rosehip', 'moonmilk', 'starpetal']),
      withPours([]),
    ]
    for (const values of others)
      expect(sameBuild(layered, potion({ mixed: 'yes', ...values })), JSON.stringify(values)).toBe(
        false,
      )
  })
})

describe('the spec a built bottle is drawn as, the build a frame or two behind the latest spec', () => {
  const three = withPours(['moonmilk', 'rosehip', 'starpetal'])
  const layered = potion({ ...three, mixed: 'no' })
  const mixed = potion({ ...three, mixed: 'yes' })
  const empty = potion(withPours([]))

  test('a bottle that turns mixed is drawn mixed at once, with no rebuild, and one put back to its layers is layered at once', () => {
    expect(shownSpec(layered, layered, mixed)).toBe(mixed)
    expect(shownSpec(mixed, mixed, layered)).toBe(layered)
    expect(shownSpec(mixed, layered, mixed).mixed).toBe(true)
  })

  test('an emptied bottle keeps drawing the mix until the empty one is built, though it was built before it mixed', () => {
    expect(shownSpec(mixed, mixed, empty).mixed).toBe(true)
    expect(shownSpec(mixed, layered, empty).mixed).toBe(true)
    expect(shownSpec(mixed, empty, empty)).toBe(empty)
  })

  test("a new recipe keeps the built one's state until it is built, then takes its own", () => {
    const other = withPours(['frogfizz', 'frogfizz', 'snailshine'])
    const next = potion({ ...other, mixed: 'yes' })
    expect(shownSpec(layered, layered, next).mixed).toBe(false)
    expect(shownSpec(mixed, layered, potion({ ...other, mixed: 'no' })).mixed).toBe(true)
    expect(shownSpec(layered, next, next)).toBe(next)
    expect(shownSpec(layered, next, empty)).toBe(next)
  })
})

describe('the stopper as it is drawn', () => {
  test('rises along the axis and turns about it, from numbers or holders, and only updates when it moves', () => {
    const stopper = new THREE.Mesh()
    const updated = vi.spyOn(stopper, 'updateMatrixWorld')
    poseStopper(stopper, 0, 0)
    expect(updated).not.toHaveBeenCalled()
    const lift = { current: 4 }
    const turn = { current: 0.5 }
    poseStopper(stopper, lift, turn)
    expect([stopper.position.z, stopper.rotation.z]).toEqual([4, 0.5])
    expect(updated).toHaveBeenCalledTimes(1)
    poseStopper(stopper, lift, turn)
    expect(updated).toHaveBeenCalledTimes(1)
    turn.current = 0.6
    poseStopper(stopper, lift, turn)
    expect(stopper.rotation.z).toBe(0.6)
    poseStopper(stopper, 2)
    expect([stopper.position.z, stopper.rotation.z]).toEqual([2, 0])
  })
})

describe('the held bottle', () => {
  test('is held upright for as long as its show lasts', () => {
    const full = potion(withPours(['moonmilk', 'rosehip', 'starpetal']))
    const two = potion(withPours(['frogfizz', 'rosehip']))
    expect(potionHeldItem(full).flourishSeconds).toBe(
      showSeconds({ full: true, reducedMotion: false }),
    )
    expect(potionHeldItem(full, true).flourishSeconds).toBe(
      showSeconds({ full: true, reducedMotion: true }),
    )
    expect(potionHeldItem(two).flourishSeconds).toBe(
      showSeconds({ full: false, reducedMotion: false }),
    )
    expect(potionHeldItem(full).flourishSeconds).toBeGreaterThan(5)
  })

  test('a tap beside it misses it, however far it has turned about its axis', () => {
    const ray = new THREE.Raycaster()
    for (const shape of SHAPES)
      for (const neck of [0, 1]) {
        const spec = potion({ shape, neck })
        const item = potionHeldItem(spec)
        const mesh = new THREE.Mesh(hitGeometry(item.hit))
        const r = (item.widthMm! / 2) * MM
        for (let roll = 0; roll < Math.PI; roll += Math.PI / 12) {
          mesh.rotation.set(0, roll, 0)
          mesh.updateMatrixWorld()
          for (const side of [1, -1]) {
            const at = (x: number) => {
              ray.set(new THREE.Vector3(x * side, 0, 10), new THREE.Vector3(0, 0, -1))
              return ray.intersectObject(mesh).length > 0
            }
            expect(at(0.9 * r), `${shape} ${neck} on, roll ${roll.toFixed(2)}`).toBe(true)
            expect(at(1.25 * r), `${shape} ${neck} beside, roll ${roll.toFixed(2)}`).toBe(false)
          }
        }
      }
  })

  const PHONES = [
    { width: 390, height: 844 },
    { width: 360, height: 780 },
    { width: 430, height: 932 },
  ]
  const pxOf = (height: number) => height / (2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360))

  for (const screen of PHONES)
    for (const shape of SHAPES)
      test(`on a ${screen.width}x${screen.height} phone the ${shape} bottle leans to the limit inside the screen, centred`, () => {
        for (const neck of [0, 1]) leansInside(screen, potionHeldItem(potion({ shape, neck })))
      })

  function leansInside(screen: { width: number; height: number }, item: HeldItem) {
    const outline = item.outline!
    const pivot = item.grip * item.lengthMm
    const px = pxOf(screen.height)
    const perMm = uprightScale(item, screen, px) * MM * px
    let widest = 0
    for (let lean = -LEAN_MAX; lean <= LEAN_MAX + 1e-9; lean += LEAN_MAX / 12) {
      const shift = leanShiftMm(outline, pivot, lean)
      const across = outline.map(
        ([x, y]) => (x * Math.cos(lean) + (y - pivot) * Math.sin(lean) + shift) * perMm,
      )
      const left = screen.width / 2 + Math.min(...across)
      const right = screen.width / 2 + Math.max(...across)
      expect(left).toBeGreaterThanOrEqual(LEAN_MARGIN * screen.width - 0.5)
      expect(right).toBeLessThanOrEqual((1 - LEAN_MARGIN) * screen.width + 0.5)
      expect((left + right) / 2).toBeCloseTo(screen.width / 2, 6)
      widest = Math.max(widest, right - left)
    }
    // Never bigger than it stood before; where the lean is what limits it, it uses the width.
    const upright = { ...item, outline: undefined }
    const fitted = uprightScale(item, screen, px)
    expect(fitted).toBeLessThanOrEqual(uprightScale(upright, screen, px))
    if (fitted < uprightScale(upright, screen, px))
      expect(widest).toBeCloseTo((1 - 2 * LEAN_MARGIN) * screen.width, 0)
  }

  test('on a desk and on a phone turned sideways it is the size it was', () => {
    const item = potionHeldItem(potion({ shape: 'round', neck: 1 }))
    const upright = { ...item, outline: undefined }
    for (const screen of [
      { width: 1440, height: 900 },
      { width: 844, height: 390 },
    ]) {
      const px = pxOf(screen.height)
      expect(uprightScale(item, screen, px)).toBe(uprightScale(upright, screen, px))
    }
  })
})
