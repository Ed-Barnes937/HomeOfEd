import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { asideWork, swingStopper } from './PotionCloseUpStage.tsx'
import { type PotionShow, showRest } from './potionShow.ts'
import { MM } from './scene.tsx'

const REACH_MM = 24
const PIVOT_MM = 150

/** A held bottle as the mesh builds it: a millimetre frame standing along its own z, its stopper inside. */
function heldBottle(lean = 0) {
  const held = new THREE.Group()
  held.rotation.z = -lean
  const frame = new THREE.Group()
  frame.rotation.x = -Math.PI / 2
  frame.scale.setScalar(MM)
  const stopper = new THREE.Group()
  stopper.name = 'stopper'
  frame.add(stopper)
  held.add(frame)
  held.updateMatrixWorld(true)
  /** How far the stopper's pivot has moved across the scene, in mm, and which way its top leans. */
  const swung = () => {
    held.updateMatrixWorld(true)
    const at = (parent: THREE.Object3D) =>
      new THREE.Vector3(0, 0, PIVOT_MM).applyMatrix4(parent.matrixWorld)
    const top = new THREE.Vector3().setFromMatrixColumn(stopper.matrixWorld, 2).normalize()
    const axis = new THREE.Vector3().setFromMatrixColumn(frame.matrixWorld, 2).normalize()
    return { moved: at(stopper).sub(at(frame)).divideScalar(MM), leans: top.sub(axis) }
  }
  return { held, stopper, swung }
}

const out = (stopperAside: number): PotionShow => ({ ...showRest(1), popped: true, stopperAside })

describe('the popped stopper swung aside', () => {
  it('stays seated while the show has it seated', () => {
    const { held, stopper } = heldBottle()
    const work = asideWork()
    swingStopper(work, held, showRest(1), REACH_MM, PIVOT_MM)
    expect(stopper.position.toArray()).toEqual([0, 0, 0])
    expect(stopper.quaternion.toArray()).toEqual([0, 0, 0, 1])
  })

  it('swings to the right of an upright bottle, leaning out, and comes back to its seat', () => {
    const { held, stopper, swung } = heldBottle()
    const work = asideWork()
    swingStopper(work, held, out(0.5), REACH_MM, PIVOT_MM)
    expect(swung().moved.x).toBeCloseTo(REACH_MM / 2, 6)
    swingStopper(work, held, out(1), REACH_MM, PIVOT_MM)
    const { moved, leans } = swung()
    expect(moved.x).toBeCloseTo(REACH_MM, 6)
    expect(moved.y).toBeCloseTo(0, 6)
    expect(moved.z).toBeCloseTo(0, 6)
    expect(leans.x).toBeGreaterThan(0.2)
    swingStopper(work, held, showRest(1), REACH_MM, PIVOT_MM)
    expect(stopper.position.toArray()).toEqual([0, 0, 0])
    expect(stopper.quaternion.toArray()).toEqual([0, 0, 0, 1])
  })

  it('swings across the screen however the bottle has turned about its axis', () => {
    const { held, swung } = heldBottle()
    held.children[0]!.rotateZ(1.1)
    held.updateMatrixWorld(true)
    swingStopper(asideWork(), held, out(1), REACH_MM, PIVOT_MM)
    const { moved } = swung()
    expect(moved.x).toBeCloseTo(REACH_MM, 6)
    expect(moved.z).toBeCloseTo(0, 6)
  })

  it('swings to the upper side of a bottle that leans, either way', () => {
    for (const lean of [0.9, -0.9]) {
      const { held, swung } = heldBottle(lean)
      swingStopper(asideWork(), held, out(1), REACH_MM, PIVOT_MM)
      const { moved } = swung()
      expect(moved.y).toBeGreaterThan(0)
      expect(Math.sign(moved.x)).toBe(-Math.sign(lean))
      expect(moved.length()).toBeCloseTo(REACH_MM, 6)
    }
  })

  it('keeps the side it took at the pop while the bottle is leaned afterwards', () => {
    const { held, swung } = heldBottle()
    const work = asideWork()
    swingStopper(work, held, out(0.2), REACH_MM, PIVOT_MM)
    held.rotation.z = -0.9
    held.updateMatrixWorld(true)
    swingStopper(work, held, out(1), REACH_MM, PIVOT_MM)
    expect(swung().moved.x).toBeGreaterThan(0)
  })
})
