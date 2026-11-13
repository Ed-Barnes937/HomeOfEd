import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

import { boxCameraPosition } from './boxRig.tsx'
import {
  CAMERA_DISTANCE,
  heldTurn,
  liftStart,
  liftTurn,
  UPRIGHT_TO_LEVEL,
  type HeldItem,
} from './HeldRig.tsx'
import { heldTilt } from './hold.ts'
import { FOV, FRONT_CAMERA_PITCH } from './scene.tsx'

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

const CANVAS: Rect = { left: 0, top: 0, width: 1280, height: 800 }
const BOX: Rect = { left: 760, top: 120, width: 420, height: 560 }
/** The box stage's half width in its own scene units, and the scale it draws the item at. */
const STAGE_HALF_WIDTH = 1.2
const BOX_SCALE = 1.7

const upright = (boxCentreY?: number): HeldItem => ({
  lengthMm: 160,
  tip: [0, 0, 0],
  hit: [1, 1, 1],
  grip: 0.5,
  flourishScale: 1,
  trailColour: null,
  boxHalfWidth: STAGE_HALF_WIDTH / BOX_SCALE,
  hold: 'upright',
  flourish: 'own',
  boxView: 'front',
  ...(boxCentreY === undefined ? {} : { boxCentreY }),
})

/** Where `camera` draws `point` on the page, given the rect its canvas fills. */
const onPage = (camera: THREE.Camera, rect: Rect, point: THREE.Vector3) => {
  const ndc = point.clone().project(camera)
  return new THREE.Vector2(
    rect.left + ((ndc.x + 1) / 2) * rect.width,
    rect.top + ((1 - ndc.y) / 2) * rect.height,
  )
}

/** The box stage's camera, framed from the front as `Framing view="front"` frames it. */
const boxCamera = () => {
  const camera = new THREE.PerspectiveCamera(FOV, BOX.width / BOX.height, 0.1, 100)
  boxCameraPosition('front', STAGE_HALF_WIDTH, BOX.width / BOX.height, camera.position)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

const closeCamera = () => {
  const camera = new THREE.PerspectiveCamera(FOV, CANVAS.width / CANVAS.height, 0.1, 50)
  camera.position.set(0, 0, CAMERA_DISTANCE)
  camera.updateMatrixWorld()
  return camera
}

const px = CANVAS.height / (2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360))

describe('the first frame of the lift from a front-framed box', () => {
  // The box stage stands the item's centre `centre` above the look-at point, inside the box's scale.
  for (const centre of [0, 0.42, -0.3])
    test(`draws the item's centre on the pixel the box drew it, ${centre} above the look-at point`, () => {
      const start = liftStart(BOX, CANVAS, px, upright(centre), {
        position: new THREE.Vector3(),
        scale: 0,
      })
      const inBox = onPage(boxCamera(), BOX, new THREE.Vector3(0, centre * BOX_SCALE, 0))
      const lifted = onPage(closeCamera(), CANVAS, start.position)
      expect(lifted.x).toBeCloseTo(inBox.x, 6)
      expect(lifted.y).toBeCloseTo(inBox.y, 6)
    })

  for (const centre of [0, 0.42, -0.3])
    test(`draws it the size the box drew it there, ${centre} above the look-at point`, () => {
      const start = liftStart(BOX, CANVAS, px, upright(centre), {
        position: new THREE.Vector3(),
        scale: 0,
      })
      const across = 0.01
      const box = boxCamera()
      const at = new THREE.Vector3(0, centre * BOX_SCALE, 0)
      const inBox = onPage(box, BOX, at.clone().setX(across * BOX_SCALE)).distanceTo(
        onPage(box, BOX, at.clone().setX(-across * BOX_SCALE)),
      )
      const close = closeCamera()
      const lifted = onPage(
        close,
        CANVAS,
        start.position.clone().setX(start.position.x + across * start.scale),
      ).distanceTo(
        onPage(close, CANVAS, start.position.clone().setX(start.position.x - across * start.scale)),
      )
      expect(lifted).toBeCloseTo(inBox, 6)
    })

  test('leaves an item with no stand on the look-at point, as the wand and sword lie', () => {
    const none = liftStart(BOX, CANVAS, px, upright(), { position: new THREE.Vector3(), scale: 0 })
    const zero = liftStart(BOX, CANVAS, px, upright(0), { position: new THREE.Vector3(), scale: 0 })
    expect(none.position.equals(zero.position)).toBe(true)
    expect(none.scale).toBe(zero.scale)
    expect(none.scale).toBe(BOX.width / 2 / upright().boxHalfWidth / px)
  })
})

describe('an upright item, its children standing along y', () => {
  const X = new THREE.Vector3(1, 0, 0)
  const Y = new THREE.Vector3(0, 1, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const laid = new THREE.Quaternion().setFromAxisAngle(Z, UPRIGHT_TO_LEVEL)

  /** Where a turn sends each of the children's axes. */
  const axes = (turn: THREE.Quaternion) => [X, Y, Z].map((a) => a.clone().applyQuaternion(turn))
  const expectSameTurn = (a: THREE.Quaternion, b: THREE.Quaternion) => {
    for (const [u, v] of axes(a).map((u, i) => [u, axes(b)[i]!] as const))
      expect(u.distanceTo(v)).toBeLessThan(1e-9)
  }

  for (const roll of [0, 1.1, -2.5])
    test(`starts the lift turned as its box stage stood it, rolled ${roll} about y`, () => {
      const lift = liftTurn(new THREE.Quaternion(), upright(), roll).multiply(laid)
      // The box stage turns it about y; the close camera sees the box's world turned by the pitch.
      const inBox = new THREE.Quaternion()
        .setFromAxisAngle(Y, roll)
        .premultiply(new THREE.Quaternion().setFromAxisAngle(X, FRONT_CAMERA_PITCH))
      expectSameTurn(lift, inBox)
    })

  for (const portrait of [false, true])
    test(`is held standing up and facing the viewer, ${portrait ? 'portrait' : 'landscape'}`, () => {
      const tilt = heldTilt('upright', portrait)
      expectSameTurn(
        heldTurn(new THREE.Quaternion(), upright(), tilt, 0, 0, 0).multiply(laid),
        new THREE.Quaternion(),
      )
      const rolled = heldTurn(new THREE.Quaternion(), upright(), tilt, 0.7, 0.4, 0).multiply(laid)
      expectSameTurn(rolled, new THREE.Quaternion().setFromAxisAngle(Y, 0.7 + 0.4))
    })
})
