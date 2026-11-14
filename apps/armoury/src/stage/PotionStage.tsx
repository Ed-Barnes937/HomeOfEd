import { Canvas, type RootState } from '@react-three/fiber'
import { type RefObject, Suspense, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { compilePotion } from '../potion/compile.ts'
import { isGold, potionGlowColour, potionName } from '../potion/describe.ts'
import { PICTURE_GROUND } from '../potion/framing.ts'
import { Bridge, captureScene, Framing, Roller } from './boxRig.tsx'
import { CLAY, PotionMesh } from './PotionMesh.tsx'
import {
  ApothecaryEnvironment,
  ApothecaryLights,
  boxCentreY,
  ClayLights,
  ClockTicker,
  footY,
  POTION_HALF_WIDTH,
  PotionToneMapping,
  useLiquidClock,
} from './potionScene.tsx'
import { FOV } from './scene.tsx'
import { type StageHandle, type StageProps } from './stage.ts'
import styles from './WandStage.module.scss'

/** The capture drawn over the card's own ground (P2), so the glass keeps the light it adds. */
export function captureOverGround(state: RootState, ground: string): HTMLCanvasElement {
  const { gl } = state
  const clear = gl.getClearColor(new THREE.Color())
  const alpha = gl.getClearAlpha()
  gl.setClearColor(ground, 1)
  try {
    return captureScene(state)
  } finally {
    gl.setClearColor(clear, alpha)
  }
}

/** The box stage's handle: a roll by whole turns, and the picture drawn over the card's ground. */
export function potionStageHandle(
  three: RefObject<RootState | null>,
  rollTarget: RefObject<number>,
): StageHandle {
  return {
    roll: (turns) => {
      rollTarget.current += turns * Math.PI * 2
    },
    capture: () => {
      const state = three.current
      if (!state) return Promise.reject(new Error('stage not ready'))
      return Promise.resolve(captureOverGround(state, PICTURE_GROUND))
    },
  }
}

/** The potion's box stage: the bottle standing on the table, seen from the front, turned about its axis. */
export default function PotionStage({ params, reducedMotion, name, ref }: StageProps) {
  const spec = useMemo(() => compilePotion(params), [params])
  const label = useMemo(
    () => ({ name: name ?? potionName(params), gold: isGold(params) }),
    [name, params],
  )
  const glow = useRef(potionGlowColour(params))
  glow.current = potionGlowColour(params)
  const clock = useLiquidClock(reducedMotion)
  const rollTarget = useRef(0)
  const three = useRef<RootState | null>(null)

  useImperativeHandle(ref, () => potionStageHandle(three, rollTarget), [])

  return (
    <div className={styles.stage} aria-hidden="true">
      <Canvas
        camera={{ fov: FOV, near: 0.5, far: 80 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Bridge handle={three} />
        <ClockTicker clock={clock} />
        <Framing halfWidth={POTION_HALF_WIDTH} view="front" />
        <Roller target={rollTarget} axis="y">
          <group position={[0, boxCentreY(spec), 0]}>
            <PotionMesh spec={spec} clock={clock} label={label} />
          </group>
        </Roller>
        {CLAY ? (
          <ClayLights />
        ) : (
          <>
            <PotionToneMapping />
            <ApothecaryLights clock={clock} glow={glow} footY={footY(POTION_HALF_WIDTH)} />
            <Suspense fallback={null}>
              <ApothecaryEnvironment />
            </Suspense>
          </>
        )}
      </Canvas>
    </div>
  )
}

export { PotionCloseUpStage } from './PotionCloseUpStage.tsx'
