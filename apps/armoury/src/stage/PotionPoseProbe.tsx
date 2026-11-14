import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

// Dev-only, for the GPU gate shots: publishes the bottle's pose as last drawn, from its glass's
// world matrix against the up frame and the camera, in degrees.
interface Probe {
  potionPose?: { lean: number; tip: number; tilt: number } | null
}

const DEGREES = 180 / Math.PI

export function PotionPoseProbe({ up }: { up: RefObject<THREE.Object3D | null> }) {
  const mark = useRef<THREE.Group>(null)
  const v = useMemo(
    () => ({
      axis: new THREE.Vector3(),
      up: new THREE.Vector3(),
      right: new THREE.Vector3(),
      viewer: new THREE.Vector3(),
    }),
    [],
  )
  useEffect(
    () => () => {
      ;(window as Window & Probe).potionPose = null
    },
    [],
  )
  useFrame(({ camera }) => {
    const probe = window as Window & Probe
    const glass = mark.current?.parent?.getObjectByName('glass')
    if (!glass || !up.current) {
      probe.potionPose = null
      return
    }
    // The bottle is built standing along its own z; matrixWorld is as of the last render.
    v.axis.setFromMatrixColumn(glass.matrixWorld, 2).normalize()
    v.up.setFromMatrixColumn(up.current.matrixWorld, 1).normalize()
    v.right.setFromMatrixColumn(camera.matrixWorld, 0)
    v.right.addScaledVector(v.up, -v.right.dot(v.up)).normalize()
    v.viewer.crossVectors(v.right, v.up)
    const across = v.axis.dot(v.right)
    const along = v.axis.dot(v.up)
    const towards = v.axis.dot(v.viewer)
    probe.potionPose = {
      lean: Math.atan2(across, along) * DEGREES,
      tip: Math.asin(THREE.MathUtils.clamp(towards, -1, 1)) * DEGREES,
      tilt: Math.acos(THREE.MathUtils.clamp(along, -1, 1)) * DEGREES,
    }
  }, -1)
  return <group ref={mark} />
}
