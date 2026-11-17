import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type * as THREE from 'three'

import { BOX_CAMERA_LEAN, FOV, FRONT_CAMERA_PITCH } from './scene.tsx'

const CAPTURE_WIDTH = 2000

/** Where the box stage's camera looks from: above, or the front pitched down by `FRONT_CAMERA_PITCH`. */
export type BoxView = 'above' | 'front'

/** Where the box stage's camera stands, looking at the origin, so `halfWidth` either side of the middle spans its width. */
export function boxCameraPosition(
  view: BoxView,
  halfWidth: number,
  aspect: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const dist = halfWidth / (Math.tan((FOV * Math.PI) / 360) * aspect)
  if (view === 'front')
    return out.set(0, dist * Math.sin(FRONT_CAMERA_PITCH), dist * Math.cos(FRONT_CAMERA_PITCH))
  return out.set(0, dist, dist * BOX_CAMERA_LEAN)
}

/** Puts the camera at its `view` of the box so `halfWidth` scene units either side of the middle span its width. */
export function Framing({ halfWidth, view = 'above' }: { halfWidth: number; view?: BoxView }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    boxCameraPosition(view, halfWidth, size.width / size.height, camera.position)
    camera.lookAt(0, 0, 0)
  }, [camera, size, halfWidth, view])
  return null
}

/** Eases its children round to `target` radians: about x for an item lying down, about y for one standing. */
export function Roller({
  target,
  axis = 'x',
  children,
}: {
  target: { current: number }
  axis?: 'x' | 'y'
  children: React.ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!group.current) return
    const r = group.current.rotation
    r[axis] += (target.current - r[axis]) * Math.min(1, delta * 8)
  })
  return <group ref={group}>{children}</group>
}

export function Bridge({ handle }: { handle: { current: RootState | null } }) {
  handle.current = useThree()
  return null
}

/** Renders the bare scene large, without bloom, and copies it off the GL canvas. */
export function captureScene({ gl, scene, camera, size }: RootState): HTMLCanvasElement {
  const pixelRatio = gl.getPixelRatio()
  const scale = CAPTURE_WIDTH / size.width
  gl.setPixelRatio(1)
  gl.setSize(CAPTURE_WIDTH, Math.round(size.height * scale), false)
  gl.render(scene, camera)
  const out = document.createElement('canvas')
  out.width = gl.domElement.width
  out.height = gl.domElement.height
  out.getContext('2d')?.drawImage(gl.domElement, 0, 0)
  gl.setPixelRatio(pixelRatio)
  gl.setSize(size.width, size.height, false)
  return out
}
