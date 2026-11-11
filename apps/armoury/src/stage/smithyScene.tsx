import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useRef, type Ref } from 'react'
import * as THREE from 'three'

import { drawnFraction, LONGEST_SWORD_MM } from '../sword/framing.ts'
import { MM } from './scene.tsx'
import { BLOOM_THRESHOLD, STAGE_FILL } from './stage.ts'

// The smithy's light, in the box's frame (camera above, x to the tip, z towards the viewer):
// the forge's warm key low on the left, the window's cool light high on the right and behind.

export const FORGE = { position: [-4, 1.6, 0.6], colour: '#ff9a4a', intensity: 2.6 } as const
export const WINDOW = { position: [2.5, 4, -3], colour: '#bcd4ff', intensity: 1.6 } as const
export const SMITHY_RIM = 0.6
const RIM = { position: [0.5, 1, -3], colour: '#cfd8ff' } as const

export function SmithyLights({
  rim,
  flicker = false,
}: {
  rim?: Ref<THREE.DirectionalLight>
  flicker?: boolean
}) {
  const forge = useRef<THREE.DirectionalLight>(null)
  useFrame(({ clock }) => {
    if (!flicker || !forge.current) return
    const t = clock.elapsedTime
    forge.current.intensity =
      FORGE.intensity * (1 + 0.03 * Math.sin(t * 1.3) + 0.02 * Math.sin(t * 2.9 + 1))
  })
  return (
    <>
      <directionalLight
        ref={forge}
        position={FORGE.position}
        intensity={FORGE.intensity}
        color={FORGE.colour}
      />
      <directionalLight
        position={WINDOW.position}
        intensity={WINDOW.intensity}
        color={WINDOW.colour}
      />
      <directionalLight
        ref={rim}
        position={RIM.position}
        intensity={SMITHY_RIM}
        color={RIM.colour}
      />
    </>
  )
}

/** What steel reflects: the studio map with the forge, the window and a soft overhead laid over it. */
export function SmithyEnvironment() {
  return (
    <Environment files="/hdri/studio.hdr" resolution={256} environmentIntensity={1}>
      <Lightformer
        form="rect"
        color={FORGE.colour}
        intensity={4}
        position={[-6, 0.8, 1]}
        scale={[8, 1.2, 1]}
      />
      <Lightformer
        form="rect"
        color={WINDOW.colour}
        intensity={3}
        position={[4, 6, -4]}
        scale={[3, 4, 1]}
      />
      <Lightformer
        form="rect"
        color="#fff4e8"
        intensity={0.8}
        position={[1.5, 8, -1]}
        scale={[10, 6, 1]}
      />
    </Environment>
  )
}

/** The longest sword spans STAGE_FILL of the stage at its own size; shorter ones are drawn larger (decision O3). */
export const SWORD_HALF_WIDTH = (LONGEST_SWORD_MM * MM) / 2 / STAGE_FILL

/** How much larger than life a sword of this length is drawn on the anvil. */
export const boxScale = (lengthMm: number) =>
  (drawnFraction(lengthMm) * LONGEST_SWORD_MM) / lengthMm

export const SWORD_TONE_MAPPING = ToneMappingMode.AGX
export const CAPTURE_TONE_MAPPING = THREE.AgXToneMapping

/** Bloom at the wand's settings, then the tone mapper so polished steel rolls off instead of clipping. */
export function SmithyEffects() {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={BLOOM_THRESHOLD} intensity={1.1} radius={0.7} />
      <ToneMapping mode={SWORD_TONE_MAPPING} />
    </EffectComposer>
  )
}
