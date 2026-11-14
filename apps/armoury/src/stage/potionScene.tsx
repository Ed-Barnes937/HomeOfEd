import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'

import { CANDLE, FOOT, UNITS_PER_MM } from '../apothecary/tableArt.ts'
import type { PotionSpec } from '../potion/compile.ts'
import { BASE_LINE, HEADROOM, TALLEST_MM } from '../potion/framing.ts'
import { boxCameraPosition } from './boxRig.tsx'
import { candleFlicker, freezeFrom, LiquidClock } from './potionMaterials.ts'
import { FRONT_CAMERA_PITCH, MM } from './scene.tsx'

/** The box stage's width over its height: the brewing table's slot is square, so the foot line is fixed. */
export const STAGE_ASPECT = 1

/**
 * The box stage's horizontal half span: the tallest bottle, foot on the base line, leaves `HEADROOM`
 * above it. Bottles are drawn true to one another, so each stands at its `heightFraction` with no scale.
 */
export const POTION_HALF_WIDTH = ((TALLEST_MM * MM) / (2 * (BASE_LINE - HEADROOM))) * STAGE_ASPECT

const camera = new THREE.Vector3()

/** How far below the front camera's look-at point a point is drawn on the base line, for a stage `halfWidth` wide. */
export function footY(halfWidth: number): number {
  const d = boxCameraPosition('front', halfWidth, STAGE_ASPECT, camera).length()
  const s = (1 - 2 * BASE_LINE) * (halfWidth / STAGE_ASPECT)
  return (s * d) / (d * Math.cos(FRONT_CAMERA_PITCH) + s * Math.sin(FRONT_CAMERA_PITCH))
}

/** Where the box stage stands the bottle's centre so its foot is on the base line. */
export const boxCentreY = (spec: PotionSpec) => footY(POTION_HALF_WIDTH) + (spec.heightMm * MM) / 2

export const CLAY_RIM = 0.8

/** Neutral white, in the box's frame: a key from the upper left, a fill from the right, a rim from behind. */
export function ClayLights({ rim }: { rim?: Ref<THREE.DirectionalLight> }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#5a5a5a', 0.55]} />
      <directionalLight position={[-2.5, 3.5, 3]} intensity={2.1} />
      <directionalLight position={[3, 0.6, 2.5]} intensity={0.6} />
      <directionalLight ref={rim} position={[0.6, 1.8, -3]} intensity={CLAY_RIM} />
    </>
  )
}

/** ACES on the potion's canvases only: AgX, the smithy's, turns the liquids pastel (ADR 0109). */
export const POTION_TONE_MAPPING = THREE.ACESFilmicToneMapping

const CANDLE_LIGHT = '#ffa354'
const FLAME = '#ffc77a'
const MOON = '#9db8ff'

/** The scene's candle from the bottle's foot, in scene units: the art's flame, a little in front of the bottle. */
export const CANDLE_AT = new THREE.Vector3(
  ((CANDLE.x - FOOT.x) / UNITS_PER_MM) * MM,
  ((FOOT.y - CANDLE.flameY) / UNITS_PER_MM) * MM,
  0.9,
)
/** The cool rim, high behind on the right. */
export const MOON_AT = new THREE.Vector3(2.2, 2.4, -2.6)

/** M1: one candle low on the left and a cool moonlit rim from behind on the right, from the foot. */
export const LAMPS = {
  candle: { colour: CANDLE_LIGHT, intensity: 9 },
  moon: { colour: MOON, intensity: 1.5 },
  fill: { position: [0.5, 3, 4] as const, colour: '#c9b8a8', intensity: 0.1 },
  /** The light the liquid gives the paper and the stopper beside it: weak, in the potion's glow colour. */
  glow: { intensity: 0.025 },
  /** The moon's light through the liquid towards the eye. */
  through: 0.55,
}

/** Around the bottle's middle, as reflections in the glass: the candle's flame and its warm wash, the dim room, the cool window light. */
const FORMERS: {
  form: 'rect' | 'circle'
  position: [number, number, number]
  scale: [number, number, number]
  colour: string
  intensity: number
}[] = [
  { form: 'circle', position: [-5, 0.35, 2.2], scale: [0.55, 1, 1], colour: FLAME, intensity: 7 },
  {
    form: 'circle',
    position: [-5, -0.2, 3],
    scale: [2.2, 2.2, 1],
    colour: CANDLE_LIGHT,
    intensity: 0.35,
  },
  { form: 'rect', position: [0, -4, 1.5], scale: [10, 4, 1], colour: '#4a2e1c', intensity: 0.45 },
  {
    form: 'rect',
    position: [-3.2, 1.1, 5.2],
    scale: [0.55, 3.4, 1],
    colour: '#ffcf9a',
    intensity: 0.8,
  },
  { form: 'rect', position: [0, 0.2, -6], scale: [9, 1.2, 1], colour: '#6a5040', intensity: 0.6 },
  { form: 'rect', position: [3.6, 2.7, -4.5], scale: [2.2, 3, 1], colour: MOON, intensity: 2.2 },
  { form: 'rect', position: [4.6, 0.5, -1.5], scale: [0.5, 4, 1], colour: MOON, intensity: 1.6 },
  { form: 'rect', position: [0, 6.3, 0], scale: [6, 6, 1], colour: '#3a2c22', intensity: 0.35 },
]

export function ApothecaryEnvironment() {
  return (
    <Environment resolution={256} environmentIntensity={1}>
      <color attach="background" args={['#0d0907']} />
      {FORMERS.map((f, i) => (
        <Lightformer
          key={i}
          form={f.form}
          color={f.colour}
          intensity={f.intensity}
          position={f.position}
          scale={f.scale}
          target={[0, 0, 0]}
        />
      ))}
    </Environment>
  )
}

/** Sets this canvas's tone mapping; the wand's and the sword's canvases keep their own. */
export function PotionToneMapping() {
  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    gl.toneMapping = POTION_TONE_MAPPING
  }, [gl])
  return null
}

/** A stage's liquid clock: held under reduced motion, frozen by `?freeze=` on a dev server. */
export function useLiquidClock(reducedMotion: boolean): LiquidClock {
  return useMemo(
    () =>
      new LiquidClock({
        frozenAt:
          typeof location === 'undefined' ? null : freezeFrom(location.search, import.meta.env.DEV),
        still: reducedMotion,
      }),
    [reducedMotion],
  )
}

/** Ticks `clock` once a frame, inside its canvas, before anything reads it. */
export function ClockTicker({ clock }: { clock: LiquidClock }) {
  useFrame((_, delta) => {
    clock.tick(delta)
  })
  return null
}

export interface ApothecaryLightsProps {
  clock: LiquidClock
  /** The potion's glow colour, read each frame. */
  glow: { readonly current: string }
  /** The bottle's foot below the lights' origin, scene units. */
  footY: number
}

/** M1's lamps as three lights, from the foot: the candle flickers a few percent unless the clock stands still. */
export function ApothecaryLights({ clock, glow, footY }: ApothecaryLightsProps) {
  const candle = useRef<THREE.PointLight>(null)
  const pool = useRef<THREE.PointLight>(null)
  useFrame(() => {
    if (candle.current)
      candle.current.intensity = LAMPS.candle.intensity * candleFlicker(clock.time)
    if (pool.current) pool.current.color.set(glow.current)
  })
  return (
    <group position={[0, footY, 0]}>
      <pointLight
        ref={candle}
        position={CANDLE_AT.toArray()}
        color={LAMPS.candle.colour}
        intensity={LAMPS.candle.intensity}
        decay={2}
      />
      <directionalLight
        position={MOON_AT.toArray()}
        color={LAMPS.moon.colour}
        intensity={LAMPS.moon.intensity}
      />
      <directionalLight
        position={[...LAMPS.fill.position]}
        color={LAMPS.fill.colour}
        intensity={LAMPS.fill.intensity}
      />
      <pointLight
        ref={pool}
        position={[0, -0.05, 0.9]}
        intensity={LAMPS.glow.intensity}
        decay={2}
      />
    </group>
  )
}
