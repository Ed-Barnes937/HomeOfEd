import { Environment } from '@react-three/drei'
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'

import { compileWand } from '../wand/compile.ts'
import { LONGEST_WAND_MM, STAGE_FILL, type StageHandle, type StageProps } from './stage.ts'
import { BOX_CAMERA_LEAN, FOV, ShopLights } from './scene.tsx'
import styles from './WandStage.module.scss'
import { MM, WandMesh } from './WandMesh.tsx'

const CAPTURE_WIDTH = 2000

function Framing() {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const aspect = size.width / size.height
    const halfWidth = (LONGEST_WAND_MM * MM) / 2 / STAGE_FILL
    const dist = halfWidth / (Math.tan((FOV * Math.PI) / 360) * aspect)
    camera.position.set(0, dist, dist * BOX_CAMERA_LEAN)
    camera.lookAt(0, 0, 0)
  }, [camera, size])
  return null
}

function Roller({ target, children }: { target: { current: number }; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!group.current) return
    const r = group.current.rotation
    r.x += (target.current - r.x) * Math.min(1, delta * 8)
  })
  return <group ref={group}>{children}</group>
}

type ThreeState = RootState

function Bridge({ handle }: { handle: { current: ThreeState | null } }) {
  handle.current = useThree()
  return null
}

export default function WandStage({ params, reducedMotion, ref }: StageProps) {
  const spec = useMemo(() => compileWand(params), [params])
  const rollTarget = useRef(0)
  const three = useRef<ThreeState | null>(null)

  useImperativeHandle(
    ref,
    (): StageHandle => ({
      roll: (turns) => {
        rollTarget.current += turns * Math.PI * 2
      },
      capture: () => {
        const state = three.current
        if (!state) return Promise.reject(new Error('stage not ready'))
        return Promise.resolve(captureWand(state))
      },
    }),
    [],
  )

  return (
    <div className={styles.stage} aria-hidden="true">
      <Canvas
        camera={{ fov: FOV, near: 0.05, far: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Bridge handle={three} />
        <Framing />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio.hdr" environmentIntensity={0.45} />
          <Roller target={rollTarget}>
            <WandMesh spec={spec} castAt={null} reducedMotion={reducedMotion} />
          </Roller>
        </Suspense>
        <ShopLights />
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1.4} intensity={1.1} radius={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

/** Renders the bare wand large, without bloom, and copies it off the GL canvas. */
function captureWand({ gl, scene, camera, size }: ThreeState): HTMLCanvasElement {
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

export { CloseUpStage } from './CloseUpStage.tsx'
