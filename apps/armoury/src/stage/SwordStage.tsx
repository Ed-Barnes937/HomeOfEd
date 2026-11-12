import { Canvas, type RootState } from '@react-three/fiber'
import { Suspense, useImperativeHandle, useMemo, useRef } from 'react'

import { compileSword } from '../sword/compile.ts'
import { Bridge, captureScene, Framing, Roller } from './boxRig.tsx'
import { FOV } from './scene.tsx'
import {
  boxScale,
  CAPTURE_TONE_MAPPING,
  SmithyEffects,
  SmithyEnvironment,
  SmithyLights,
  SWORD_HALF_WIDTH,
} from './smithyScene.tsx'
import { type StageHandle, type StageProps } from './stage.ts'
import styles from './WandStage.module.scss'
import { SwordMesh } from './SwordMesh.tsx'

export default function SwordStage({ params, reducedMotion, ref }: StageProps) {
  const spec = useMemo(() => compileSword(params), [params])
  const rollTarget = useRef(0)
  const three = useRef<RootState | null>(null)

  useImperativeHandle(
    ref,
    (): StageHandle => ({
      roll: (turns) => {
        rollTarget.current += turns * Math.PI * 2
      },
      capture: () => {
        const state = three.current
        if (!state) return Promise.reject(new Error('stage not ready'))
        // The picture skips the composer, so the renderer tone maps it instead.
        const { gl } = state
        const before = gl.toneMapping
        gl.toneMapping = CAPTURE_TONE_MAPPING
        try {
          return Promise.resolve(captureScene(state))
        } finally {
          gl.toneMapping = before
        }
      },
    }),
    [],
  )

  return (
    <div className={styles.stage} aria-hidden="true">
      <Canvas
        camera={{ fov: FOV, near: 0.5, far: 80 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Bridge handle={three} />
        <Framing halfWidth={SWORD_HALF_WIDTH} />
        <Suspense fallback={null}>
          <SmithyEnvironment />
          <Roller target={rollTarget}>
            <group scale={boxScale(spec.lengthMm)}>
              <SwordMesh spec={spec} />
            </group>
          </Roller>
        </Suspense>
        <SmithyLights flicker={!reducedMotion} />
        <SmithyEffects />
      </Canvas>
    </div>
  )
}

export { SwordCloseUpStage } from './SwordCloseUpStage.tsx'
