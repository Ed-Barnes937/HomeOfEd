import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type * as THREE from 'three'

import { BOX_CAMERA_LEAN, FOV } from './scene.tsx'

const CAPTURE_WIDTH = 2000

/** Puts the camera above the box so `halfWidth` scene units either side of the middle span its width. */
export function Framing({ halfWidth }: { halfWidth: number }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const aspect = size.width / size.height
    const dist = halfWidth / (Math.tan((FOV * Math.PI) / 360) * aspect)
    camera.position.set(0, dist, dist * BOX_CAMERA_LEAN)
    camera.lookAt(0, 0, 0)
  }, [camera, size, halfWidth])
  return null
}

export function Roller({
  target,
  children,
}: {
  target: { current: number }
  children: React.ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!group.current) return
    const r = group.current.rotation
    r.x += (target.current - r.x) * Math.min(1, delta * 8)
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
