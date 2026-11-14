import { useMemo } from 'react'

import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { potionOutline } from '../potion/outline.ts'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { PotionMesh } from './PotionMesh.tsx'
import { boxCentreY, CLAY_RIM, ClayLights, POTION_HALF_WIDTH } from './potionScene.tsx'
import { MM } from './scene.tsx'
import type { CloseUpProps } from './stage.ts'

/** A tap round a slim neck should still land. */
const MIN_GIRTH_MM = 30

export function potionHeldItem(spec: PotionSpec): HeldItem {
  const { widthMm, glass, stopper } = potionOutline(spec)
  const girth = Math.max(widthMm, MIN_GIRTH_MM) * MM * 1.1
  return {
    lengthMm: spec.heightMm,
    tip: [0, 0, (spec.heightMm * MM) / 2],
    hit: { radius: girth / 2, height: spec.heightMm * MM * 1.05 },
    grip: 0.5,
    flourishScale: 1,
    trailColour: null,
    boxHalfWidth: POTION_HALF_WIDTH,
    hold: 'upright',
    flourish: 'own',
    flourishSeconds: 4,
    boxView: 'front',
    boxCentreY: boxCentreY(spec),
    widthMm,
    outline: [...glass, ...stopper],
  }
}

/** The close look: the bottle rises from the table, stands up, leans and tips under a finger and rights itself. */
export function PotionCloseUpStage({ params, reducedMotion, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compilePotion(params), [params])
  const item = useMemo(() => potionHeldItem(spec), [spec])

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={ClayLights}
      rimIntensity={CLAY_RIM}
      environment={null}
      effects={null}
    >
      {(_, up) => <PotionMesh spec={spec} upFrom={up} />}
    </HeldRig>
  )
}
