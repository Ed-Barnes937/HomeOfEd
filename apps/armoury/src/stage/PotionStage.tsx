import { Canvas, type RootState } from '@react-three/fiber'
import { useImperativeHandle, useMemo, useRef } from 'react'

import { compilePotion } from '../potion/compile.ts'
import { Bridge, captureScene, Framing, Roller } from './boxRig.tsx'
import { PotionMesh } from './PotionMesh.tsx'
import { boxCentreY, boxScale, ClayLights, POTION_HALF_WIDTH } from './potionScene.tsx'
import { FOV } from './scene.tsx'
import { type StageHandle, type StageProps } from './stage.ts'
import styles from './WandStage.module.scss'

/** The potion's box stage: the bottle standing on the table, seen from the front, turned about its axis. */
export default function PotionStage({ params, ref }: StageProps) {
  const spec = useMemo(() => compilePotion(params), [params])
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
        camera={{ fov: FOV, near: 0.5, far: 80 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Bridge handle={three} />
        <Framing halfWidth={POTION_HALF_WIDTH} view="front" />
        <Roller target={rollTarget} axis="y">
          <group scale={boxScale(spec)}>
            <group position={[0, boxCentreY(spec), 0]}>
              <PotionMesh spec={spec} />
            </group>
          </group>
        </Roller>
        <ClayLights />
      </Canvas>
    </div>
  )
}

export { PotionCloseUpStage } from './PotionCloseUpStage.tsx'
