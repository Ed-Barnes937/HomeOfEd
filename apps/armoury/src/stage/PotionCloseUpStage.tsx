import { Suspense, useMemo, useRef } from 'react'

import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { isGold, potionGlowColour, potionName } from '../potion/describe.ts'
import { potionOutline } from '../potion/outline.ts'
import { FlourishProbe, PROBE } from './FlourishProbe.tsx'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { CLAY, PotionMesh } from './PotionMesh.tsx'
import {
  ApothecaryEnvironment,
  ApothecaryLights,
  boxCentreY,
  CLAY_RIM,
  ClayLights,
  ClockTicker,
  POTION_HALF_WIDTH,
  PotionToneMapping,
  useLiquidClock,
} from './potionScene.tsx'
import { PotionPoseProbe } from './PotionPoseProbe.tsx'
import { MM } from './scene.tsx'
import type { CloseUpProps } from './stage.ts'

/** A tap round a slim neck should still land. */
const MIN_GIRTH_MM = 30
/** The close look's lights stand about a bottle's middle; this far down to its foot, scene units. */
const CLOSE_FOOT_Y = -0.75

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
export function PotionCloseUpStage({ params, reducedMotion, name, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compilePotion(params), [params])
  const item = useMemo(() => potionHeldItem(spec), [spec])
  const label = useMemo(
    () => ({ name: name ?? potionName(params), gold: isGold(params) }),
    [name, params],
  )
  const glow = useRef(potionGlowColour(params))
  glow.current = potionGlowColour(params)
  const clock = useLiquidClock(reducedMotion)
  // The rig wants a component; this one closes over the clock and the glow, which it reads as it draws.
  const Lights = useMemo(
    () =>
      CLAY
        ? ClayLights
        : function PotionLights() {
            return <ApothecaryLights clock={clock} glow={glow} footY={CLOSE_FOOT_Y} />
          },
    [clock],
  )

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={Lights}
      rimIntensity={CLAY ? CLAY_RIM : 0}
      environment={
        <>
          <ClockTicker clock={clock} />
          {!CLAY && (
            <>
              <PotionToneMapping />
              <Suspense fallback={null}>
                <ApothecaryEnvironment />
              </Suspense>
            </>
          )}
        </>
      }
      effects={null}
    >
      {(flourishAt, up) => (
        <>
          <PotionMesh spec={spec} upFrom={up} clock={clock} label={label} />
          {PROBE && <FlourishProbe at={flourishAt} />}
          {PROBE && <PotionPoseProbe up={up} />}
        </>
      )}
    </HeldRig>
  )
}
