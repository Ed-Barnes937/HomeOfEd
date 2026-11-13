import type { Ref } from 'react'
import * as THREE from 'three'

import type { PotionSpec } from '../potion/compile.ts'
import { BASE_LINE, heightFraction, TALLEST_MM } from '../potion/framing.ts'
import { boxCameraPosition } from './boxRig.tsx'
import { FRONT_CAMERA_PITCH, MM } from './scene.tsx'

/** The box stage's width over its height: the brewing table's slot is square, so the foot line is fixed. */
export const STAGE_ASPECT = 1
/** The room left above the tallest bottle's stopper allowance, as a fraction of the stage's height. */
const HEADROOM = 0.1

/** The box stage's horizontal half span: the tallest bottle, foot on the base line, leaves `HEADROOM` above it. */
export const POTION_HALF_WIDTH = ((TALLEST_MM * MM) / (2 * (BASE_LINE - HEADROOM))) * STAGE_ASPECT

/** How much larger than life a bottle is drawn on the table: each at its `heightFraction` of the tallest. */
export const boxScale = (spec: PotionSpec) => (heightFraction(spec) * TALLEST_MM) / spec.heightMm

const camera = new THREE.Vector3()

/** How far below the front camera's look-at point a point is drawn on the base line, for a stage `halfWidth` wide. */
export function footY(halfWidth: number): number {
  const d = boxCameraPosition('front', halfWidth, STAGE_ASPECT, camera).length()
  const s = (1 - 2 * BASE_LINE) * (halfWidth / STAGE_ASPECT)
  return (s * d) / (d * Math.cos(FRONT_CAMERA_PITCH) + s * Math.sin(FRONT_CAMERA_PITCH))
}

/** Where the box stage stands the bottle's centre, inside its scale, so its foot is on the base line. */
export const boxCentreY = (spec: PotionSpec) =>
  footY(POTION_HALF_WIDTH / boxScale(spec)) + (spec.heightMm * MM) / 2

export const CLAY_RIM = 0.8

/** Neutral white, in the box's frame: a key from the upper left, a fill from the right, a rim from behind. */
export function ClayLights({
  rim,
  frame,
}: {
  rim?: Ref<THREE.DirectionalLight>
  /** The lights' own frame, whose up the liquid follows as the close look turns it. */
  frame?: Ref<THREE.Group>
}) {
  return (
    <group ref={frame}>
      <hemisphereLight args={['#ffffff', '#5a5a5a', 0.55]} />
      <directionalLight position={[-2.5, 3.5, 3]} intensity={2.1} />
      <directionalLight position={[3, 0.6, 2.5]} intensity={0.6} />
      <directionalLight ref={rim} position={[0.6, 1.8, -3]} intensity={CLAY_RIM} />
    </group>
  )
}
