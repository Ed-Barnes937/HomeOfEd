import { Environment, EnvironmentCube, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'

import { drawnFraction, LONGEST_SWORD_MM } from '../sword/framing.ts'
import { MM } from './scene.tsx'
import { BLOOM_THRESHOLD, STAGE_FILL } from './stage.ts'

// The smithy's light, in the box's frame (camera above, x to the tip, z towards the viewer):
// the forge's warm key low on the left, the window's cool light high on the right and behind.

export const FORGE = { position: [-4, 1.6, 0.6], colour: '#ff8a33', intensity: 2.6 } as const
export const WINDOW = { position: [2.5, 4, -3], colour: '#bcd4ff', intensity: 1.6 } as const
export const SMITHY_RIM = 0.6
/** Brightness of the studio map and each shape the steel reflects. */
export const ENV = { cellar: 1.5, forge: 4, window: 3, strip: 1, top: 0.9, front: 1.1, edge: 1.3 }
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

/** A softbox's falloff: `stops` are [x, brightness] across its width, 0 to 1, constant down its height. */
function falloff(stops: [number, number][]): THREE.DataTexture {
  const n = 256
  const data = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    let k = 0
    while (k < stops.length - 2 && stops[k + 1]![0] < x) k++
    const [x0, v0] = stops[k]!
    const [x1, v1] = stops[k + 1]!
    const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
    const v = Math.round(255 * (v0 + (v1 - v0) * t * t * (3 - 2 * t)))
    data.set([v, v, v, 255], i * 4)
  }
  const texture = new THREE.DataTexture(data, n, 1)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Where the bevels of a flat facing the close look's camera (z) and the box's (y) reflect. */
const EDGE_STRIPS: { position: [number, number, number]; warm: boolean }[] = [
  { position: [0, 4.4, 9], warm: false },
  { position: [0, -4.4, 9], warm: true },
  { position: [0, 8, -5.2], warm: false },
  { position: [0, 8, 2.75], warm: true },
]
/** Turns the cellar so its bright doorway is up and to the right, behind: the smithy's window. */
const CELLAR_TURN: [number, number, number] = [0, 1.2, 0]

/** What steel reflects: a CC0 cellar (decision O7), with the forge, the window and softboxes laid over it. */
export function SmithyEnvironment() {
  const maps = useMemo(
    () => ({
      top: falloff([
        [0, 0.05],
        [0.08, 0.95],
        [0.6, 0.75],
        [0.92, 0.95],
        [1, 0.05],
      ]),
      // Two softboxes with dark between, so a flat held up shows bands that move as it turns.
      // A framed softbox: hard-edged, so Mirror shows its edge and Satin blurs it.
      front: falloff([
        [0, 0.05],
        [0.05, 0.95],
        [0.95, 0.85],
        [1, 0.05],
      ]),
      edgeA: falloff([
        [0, 0.1],
        [0.3, 1],
        [0.6, 0.3],
        [1, 0.6],
      ]),
      edgeB: falloff([
        [0, 0.7],
        [0.45, 0.15],
        [0.8, 1],
        [1, 0.2],
      ]),
    }),
    [],
  )
  useEffect(() => () => Object.values(maps).forEach((m) => m.dispose()), [maps])
  return (
    <Environment resolution={512} environmentIntensity={1}>
      <EnvironmentCube
        background
        files="/hdri/smithy.hdr"
        backgroundIntensity={ENV.cellar}
        backgroundRotation={CELLAR_TURN}
      />
      {/* The forge's glow, low on the left. */}
      <Lightformer
        form="rect"
        color={FORGE.colour}
        intensity={ENV.forge}
        position={[-6, 0.8, 1]}
        scale={[8, 1.2, 1]}
      />
      {/* The window, high on the right and behind: the top edge's line. */}
      <Lightformer
        form="rect"
        color={WINDOW.colour}
        intensity={ENV.window}
        position={[3, 6, -6]}
        scale={[5, 3, 1]}
      />
      {/* A soft strip high in front: the bottom edge's line. */}
      <Lightformer
        form="rect"
        color="#ffe6cc"
        intensity={ENV.strip}
        position={[-1, 5, 6]}
        scale={[12, 0.8, 1]}
      />
      {/* Overhead, falling off along the blade, so the flat on the anvil shows a gradient. */}
      <Lightformer
        form="rect"
        color="#fff4e8"
        intensity={ENV.top}
        position={[1.5, 8, -0.6]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[8, 2.5, 1]}
        map={maps.top}
      />
      {/* Behind the close look's camera, so the flat held up to it is never a dead grey. */}
      <Lightformer
        form="rect"
        color="#fff4e8"
        intensity={ENV.front}
        position={[2, 4, 9]}
        scale={[5, 3, 1]}
        map={maps.front}
      />
      {/* Thin bright strips where the edge bevels look, so each edge reads as a line of light. */}
      {EDGE_STRIPS.map(({ position, warm }, i) => (
        <Lightformer
          key={i}
          form="rect"
          color={warm ? FORGE.colour : WINDOW.colour}
          intensity={ENV.edge}
          position={position}
          scale={[16, 0.9, 1]}
          map={i % 2 ? maps.edgeB : maps.edgeA}
        />
      ))}
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
