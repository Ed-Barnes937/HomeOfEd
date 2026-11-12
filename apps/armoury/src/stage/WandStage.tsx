import { Environment } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useImperativeHandle, useMemo, useRef } from 'react'

import { compileWand } from '../wand/compile.ts'
import { Bridge, captureScene, Framing, Roller } from './boxRig.tsx'
import { FOV, ShopLights } from './scene.tsx'
import { BLOOM_THRESHOLD, type StageHandle, type StageProps } from './stage.ts'
import styles from './WandStage.module.scss'
import { BOX_HALF_WIDTH, WandMesh } from './WandMesh.tsx'

export default function WandStage({ params, reducedMotion, ref }: StageProps) {
  const spec = useMemo(() => compileWand(params), [params])
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
        return Promise.resolve(captureScene(state))
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
        <Framing halfWidth={BOX_HALF_WIDTH} />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio.hdr" environmentIntensity={0.45} />
          <Roller target={rollTarget}>
            <WandMesh spec={spec} castAt={null} reducedMotion={reducedMotion} />
          </Roller>
        </Suspense>
        <ShopLights />
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={BLOOM_THRESHOLD} intensity={1.1} radius={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

export { CloseUpStage } from './CloseUpStage.tsx'
