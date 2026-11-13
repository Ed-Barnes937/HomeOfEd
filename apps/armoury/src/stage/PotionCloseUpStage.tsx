import { useMemo, useRef, type Ref } from 'react'
import type * as THREE from 'three'

import { compilePotion } from '../potion/compile.ts'
import { potionOutline } from '../potion/outline.ts'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { PotionMesh } from './PotionMesh.tsx'
import { boxCentreY, boxScale, CLAY_RIM, ClayLights, POTION_HALF_WIDTH } from './potionScene.tsx'
import { MM } from './scene.tsx'
import type { CloseUpProps } from './stage.ts'

/** A tap round a slim neck should still land. */
const MIN_GIRTH_MM = 30

/** The close look: the bottle rises from the table, stands up, leans and tips under a finger and rights itself. */
export function PotionCloseUpStage({ params, reducedMotion, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compilePotion(params), [params])
  const item = useMemo((): HeldItem => {
    const { widthMm } = potionOutline(spec)
    const girth = Math.max(widthMm, MIN_GIRTH_MM) * MM * 1.1
    return {
      lengthMm: spec.heightMm,
      tip: [0, 0, (spec.heightMm * MM) / 2],
      hit: [girth, spec.heightMm * MM * 1.05, girth],
      grip: 0.5,
      flourishScale: 1,
      trailColour: null,
      boxHalfWidth: POTION_HALF_WIDTH / boxScale(spec),
      hold: 'upright',
      flourish: 'own',
      flourishSeconds: 4,
      boxView: 'front',
      boxCentreY: boxCentreY(spec),
      widthMm,
    }
  }, [spec])

  // The liquid's surface follows the lights' frame: the box's up as the bottle lifts, the screen's once held.
  const up = useRef<THREE.Group>(null)
  const Lights = useMemo(
    () =>
      function PotionLights({ rim }: { rim?: Ref<THREE.DirectionalLight> }) {
        return <ClayLights rim={rim} frame={up} />
      },
    [],
  )

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={Lights}
      rimIntensity={CLAY_RIM}
      environment={null}
      effects={null}
    >
      {() => <PotionMesh spec={spec} upFrom={up} />}
    </HeldRig>
  )
}
