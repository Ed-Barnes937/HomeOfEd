import { useFrame } from '@react-three/fiber'
import { Suspense, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'

import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { isGold, potionGlowColour, potionName } from '../potion/describe.ts'
import { potionEffect } from '../potion/effects.ts'
import { potionOutline } from '../potion/outline.ts'
import { bottleProfile } from '../potion/profile.ts'
import { effectSeed } from './effectKinds.ts'
import { EffectShow } from './EffectShow.tsx'
import { FlourishProbe, PROBE } from './FlourishProbe.tsx'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { CLAY, PotionMesh, sameBuild } from './PotionMesh.tsx'
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
import {
  type PotionShow,
  PotionShowPlayer,
  showOptions,
  showRest,
  showSeconds,
} from './potionShow.ts'
import { MM } from './scene.tsx'
import { restingSlosh, sloshNormal, spinBetween, stepSlosh } from './slosh.ts'
import type { CloseUpHandle, CloseUpProps } from './stage.ts'

/** A tap round a slim neck should still land. */
const MIN_GIRTH_MM = 30
/** The close look's lights stand about a bottle's middle; this far down to its foot, scene units. */
const CLOSE_FOOT_Y = -0.75

/** The spec as last built from: the same object while only `mixed` changes, so the reveal makes nothing again. */
function useBuildSpec(spec: PotionSpec): PotionSpec {
  const held = useRef(spec)
  if (!sameBuild(held.current, spec)) held.current = spec
  return held.current
}

export function potionHeldItem(spec: PotionSpec, reducedMotion = false): HeldItem {
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
    flourishSeconds: showSeconds(showOptions(spec, reducedMotion)),
    boxView: 'front',
    boxCentreY: boxCentreY(spec),
    widthMm,
    outline: [...glass, ...stopper],
  }
}

/** Steps the liquid's slosh once a frame from how fast the bottle turns against `up`, writing the surface's normal into `normal`. */
function Sloshing({
  up,
  normal,
  reducedMotion,
}: {
  up: RefObject<THREE.Object3D | null>
  normal: THREE.Vector3
  reducedMotion: boolean
}) {
  const mark = useRef<THREE.Group>(null)
  const s = useMemo(
    () => ({
      slosh: restingSlosh(),
      seen: false,
      before: new THREE.Quaternion(),
      now: new THREE.Quaternion(),
      frame: new THREE.Quaternion(),
      at: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    }),
    [],
  )
  useFrame((_, delta) => {
    const bottle = mark.current
    const from = up.current
    if (!bottle || !from) return
    const dt = Math.min(delta, 0.05)
    // As last drawn: the bottle's turn seen from the up frame.
    bottle.matrixWorld.decompose(s.at, s.now, s.scale)
    from.matrixWorld.decompose(s.at, s.frame, s.scale)
    s.now.premultiply(s.frame.invert())
    if (s.seen && dt > 0) spinBetween(s.before, s.now, dt, s.spin)
    else s.spin.set(0, 0, 0)
    s.before.copy(s.now)
    s.seen = true
    stepSlosh(s.slosh, s.spin, dt, reducedMotion)
    sloshNormal(s.slosh, normal)
  })
  return <group ref={mark} />
}

/** The mouth the effect leaves by, a little inside the bore, mm below the lip. */
const MOUTH_BELOW_LIP_MM = 3
/** How far the popped stopper swings aside of the neck, and how far it leans out there. */
const ASIDE = { neckRadii: 2.6, plusMm: 3, lean: 0.4 }
/** The bottle leans this far across the screen before its stopper swings to the upper side. */
const ASIDE_LEAN = 0.12

/** Scratch for swinging the stopper aside, and where it last swung. */
const asideWork = () => ({
  stopper: null as THREE.Object3D | null,
  side: 1,
  popped: false,
  drawn: 0,
  axis: new THREE.Vector3(),
  across: new THREE.Vector3(),
  to: new THREE.Vector3(),
  about: new THREE.Vector3(),
  pivot: new THREE.Vector3(),
})

/**
 * Swings the popped stopper `aside` (0 to 1) of the neck across the screen, leaning out, so the
 * effect has the neck's axis to itself: to the right, or to the upper side of a bottle that leans.
 */
function swingStopper(
  w: ReturnType<typeof asideWork>,
  bottle: THREE.Object3D | null,
  show: PotionShow,
  reachMm: number,
  pivotMm: number,
) {
  const aside = show.stopperAside
  if (aside === 0 && w.drawn === 0 && show.popped === w.popped) return
  if (!w.stopper?.parent) w.stopper = bottle?.getObjectByName('stopper') ?? null
  const frame = w.stopper?.parent
  if (!w.stopper || !frame) return
  // The bottle's own frame as last drawn: millimetres, its axis along z.
  w.axis.setFromMatrixColumn(frame.matrixWorld, 2).normalize()
  if (show.popped && !w.popped) w.side = w.axis.x > ASIDE_LEAN ? -1 : 1
  w.popped = show.popped
  w.drawn = aside
  if (aside === 0) {
    w.stopper.position.set(0, 0, 0)
    w.stopper.quaternion.identity()
    return
  }
  w.across.set(w.axis.y, -w.axis.x, 0)
  if (w.across.lengthSq() < 1e-6) w.across.set(1, 0, 0)
  w.across.normalize().multiplyScalar(w.side)
  w.to.set(
    w.across.dot(w.axis.setFromMatrixColumn(frame.matrixWorld, 0).normalize()),
    w.across.dot(w.axis.setFromMatrixColumn(frame.matrixWorld, 1).normalize()),
    0,
  )
  w.about.set(-w.to.y, w.to.x, 0).normalize()
  w.stopper.quaternion.setFromAxisAngle(w.about, ASIDE.lean * aside)
  w.pivot.set(0, 0, pivotMm)
  w.stopper.position
    .copy(w.pivot)
    .applyQuaternion(w.stopper.quaternion)
    .negate()
    .add(w.pivot)
    .addScaledVector(w.to, reachMm * aside)
}

/** What the show writes each frame for the bottle to read as it is drawn. */
interface Drawn {
  show: { current: PotionShow }
  /** The stopper's lift, mm, and its turn. */
  stopperLift: { current: number }
  stopperTurn: { current: number }
}

/**
 * Plays the show on the rig's clock: a new one from each flourish, by the potion as it is at that
 * moment, eased to rest when the bottle is put back. Writes the liquid's mix and the stopper's
 * pose into `drawn`, lifts `lifted` along the bottle's axis and swings the popped stopper aside.
 */
function Show({
  at,
  spec,
  reducedMotion,
  leaving,
  drawn,
  lifted,
}: {
  at: number | null
  spec: PotionSpec
  reducedMotion: boolean
  leaving: { readonly current: boolean }
  drawn: Drawn
  lifted: RefObject<THREE.Object3D | null>
}) {
  const [player] = useState(() => new PotionShowPlayer())
  const s = useRef({ played: null as number | null, left: false })
  const [aside] = useState(asideWork)
  const bottle = useBuildSpec(spec)
  const { plugMm, lipMm, asideMm } = useMemo(() => {
    const profile = bottleProfile(bottle)
    return {
      plugMm: profile.stopperSeat.depthMm,
      lipMm: profile.lipZ,
      asideMm: ASIDE.neckRadii * profile.neckR + ASIDE.plusMm,
    }
  }, [bottle])
  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (leaving.current) {
      if (!s.current.left) player.leave(now)
      s.current.left = true
    } else if (at !== null && at !== s.current.played) {
      s.current.played = at
      player.play(at, showOptions(spec, reducedMotion))
    }
    const show = player.draw(now, spec.mixed ? 1 : 0)
    drawn.show.current = show
    drawn.stopperLift.current = show.stopperLift * plugMm
    drawn.stopperTurn.current = show.stopperTurn
    swingStopper(aside, lifted.current, show, asideMm, lipMm + drawn.stopperLift.current)
    if (lifted.current) lifted.current.position.y = show.lift * spec.heightMm * MM
  })
  return null
}

/** The close look: the bottle rises from the table and plays its show; it leans and tips under a finger and rights itself, its liquid sloshing. */
export function PotionCloseUpStage({ params, reducedMotion, name, ref, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compilePotion(params), [params])
  const bottle = useBuildSpec(spec)
  const item = useMemo(() => potionHeldItem(bottle, reducedMotion), [bottle, reducedMotion])
  const held = useRef<CloseUpHandle>(null)
  const leaving = useRef(false)
  const lifted = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Group>(null)
  const effect = useMemo(() => potionEffect({ ...params, mixed: 'yes' }), [params])
  const { seed, mouthY } = useMemo(
    () => ({
      seed: effectSeed(bottle.layers.map((layer) => layer.ingredient).join()),
      mouthY: (bottleProfile(bottle).lipZ - MOUTH_BELOW_LIP_MM - bottle.heightMm / 2) * MM,
    }),
    [bottle],
  )
  const [drawn] = useState((): Drawn => ({
    show: { current: showRest(spec.mixed ? 1 : 0) },
    stopperLift: { current: 0 },
    stopperTurn: { current: 0 },
  }))
  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      flourish: () => held.current?.flourish(),
      putBack: () => {
        leaving.current = true
        return held.current?.putBack() ?? Promise.resolve()
      },
    }),
    [],
  )
  const label = useMemo(
    () => ({ name: name ?? potionName(params), gold: isGold(params) }),
    [name, params],
  )
  const glow = useRef(potionGlowColour(params))
  glow.current = potionGlowColour(params)
  const clock = useLiquidClock(reducedMotion)
  const [surface] = useState(() => new THREE.Vector3(0, 1, 0))
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
      ref={held}
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
          <group ref={lifted}>
            <PotionMesh
              spec={spec}
              upFrom={up}
              surfaceNormal={surface}
              clock={clock}
              label={label}
              mix={drawn.show}
              stopperLift={drawn.stopperLift}
              stopperTurn={drawn.stopperTurn}
            />
            <group ref={mouth} position={[0, mouthY, 0]} />
          </group>
          <Sloshing up={up} normal={surface} reducedMotion={reducedMotion} />
          <Show
            at={flourishAt}
            spec={spec}
            reducedMotion={reducedMotion}
            leaving={leaving}
            drawn={drawn}
            lifted={lifted}
          />
          <EffectShow
            show={drawn.show}
            mouth={mouth}
            effect={effect}
            seed={seed}
            bottle={bottle.heightMm * MM}
          />
          {PROBE && <FlourishProbe at={flourishAt} seconds={item.flourishSeconds} />}
          {PROBE && <PotionPoseProbe up={up} surface={surface} />}
        </>
      )}
    </HeldRig>
  )
}
