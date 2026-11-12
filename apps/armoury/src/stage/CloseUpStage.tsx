import { Environment } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useMemo } from 'react'

import { compileWand } from '../wand/compile.ts'
import { reachMm } from '../wand/geometry.ts'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { MM, RIM_INTENSITY, ShopLights } from './scene.tsx'
import { BLOOM_THRESHOLD, WAVE_TO_SPELL_SECONDS, type CloseUpProps } from './stage.ts'
import { BOX_HALF_WIDTH, tipPoint, WandMesh } from './WandMesh.tsx'

/** Where a hand holds the wand, as a fraction of its length from the pommel. */
const GRIP = 0.2

export function CloseUpStage({ params, reducedMotion, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compileWand(params), [params])
  const item = useMemo((): HeldItem => {
    // Generous round a slim straight wand, and wide enough to take in the whole bow of a bent one.
    const girth = Math.max(spec.handleMaxR * 3.5, reachMm(spec) + spec.handleMaxR) * 2 * MM
    return {
      lengthMm: spec.lengthMm,
      tip: tipPoint(spec),
      hit: [spec.lengthMm * MM * 1.1, girth, girth],
      grip: GRIP,
      flourishScale: 1,
      trailColour: spec.spell,
      boxHalfWidth: BOX_HALF_WIDTH,
    }
  }, [spec])

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={ShopLights}
      rimIntensity={RIM_INTENSITY}
      environment={<Environment files="/hdri/studio.hdr" environmentIntensity={0.45} />}
      effects={
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={BLOOM_THRESHOLD} intensity={1.1} radius={0.7} />
        </EffectComposer>
      }
    >
      {(waveAt) => (
        <WandMesh
          spec={spec}
          castAt={waveAt === null ? null : waveAt + (reducedMotion ? 0 : WAVE_TO_SPELL_SECONDS)}
          reducedMotion={reducedMotion}
        />
      )}
    </HeldRig>
  )
}
