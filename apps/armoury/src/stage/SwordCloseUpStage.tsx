import { useMemo } from 'react'

import { compileSword } from '../sword/compile.ts'
import { reach } from '../sword/geometry.ts'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { MM } from './scene.tsx'
import {
  boxScale,
  SmithyEffects,
  SmithyEnvironment,
  SmithyLights,
  SMITHY_RIM,
  SWORD_HALF_WIDTH,
} from './smithyScene.tsx'
import type { CloseUpProps } from './stage.ts'
import { FLOURISH_SCALE } from './swordGlow.ts'
import { SwordMesh, swordTipPoint } from './SwordMesh.tsx'

// Dev-only, for the GPU gate shots: `?focus=tip` or `?focus=hilt` slides the sword along so a zoom lands there.
const FOCUS: Record<string, number> = { tip: -0.4, hilt: 0.3 }
const focus =
  import.meta.env.DEV && typeof location !== 'undefined'
    ? (FOCUS[new URLSearchParams(location.search).get('focus') ?? ''] ?? 0)
    : 0

/** The close look: the sword lifts off the anvil, flourishes, glints up its edge, wakes its runes, and goes back. */
export function SwordCloseUpStage({ params, reducedMotion, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compileSword(params), [params])
  const item = useMemo((): HeldItem => {
    const [across, through] = reach(spec)
    // Generous round a slim blade so a tap on it lands.
    const girth = Math.max(across * 2, 30) * MM
    return {
      lengthMm: spec.lengthMm,
      tip: swordTipPoint(spec),
      hit: [spec.lengthMm * MM * 1.05, Math.max(through * 2, 30) * MM, girth],
      grip: spec.gripAt,
      flourishScale: FLOURISH_SCALE,
      trailColour: null,
      boxHalfWidth: SWORD_HALF_WIDTH / boxScale(spec.lengthMm),
    }
  }, [spec])

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={SmithyLights}
      rimIntensity={SMITHY_RIM}
      environment={<SmithyEnvironment />}
      effects={<SmithyEffects />}
    >
      {(flourishAt) => (
        <group position={[focus * spec.lengthMm * MM, 0, 0]}>
          <SwordMesh spec={spec} flourishAt={flourishAt} reducedMotion={reducedMotion} />
        </group>
      )}
    </HeldRig>
  )
}
