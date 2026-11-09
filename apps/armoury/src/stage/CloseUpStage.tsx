import { Environment } from '@react-three/drei'
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import {
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import * as THREE from 'three'

import { compileWand, type WandSpec } from '../wand/compile.ts'
import styles from './CloseUpStage.module.scss'
import { BOX_CAMERA_LEAN, FOV, RIM_INTENSITY, ShopLights } from './scene.tsx'
import {
  LONGEST_WAND_MM,
  STAGE_FILL,
  WAVE_TO_SPELL_SECONDS,
  type BoxPose,
  type CloseUpHandle,
  type CloseUpProps,
} from './stage.ts'
import { MM, WandMesh } from './WandMesh.tsx'
import { fitWave, WAVE_SECONDS, wavePose, waveTurn } from './wave.ts'
import { WaveTrail } from './WaveTrail.tsx'

const CAMERA_DISTANCE = 8
const RISE_SECONDS = 0.8
const TAP_SLOP_PX = 6
const TURN_PER_PX = 0.007
const IDLE_ROLL_PER_SECOND = 0.35
const MIN_ZOOM = 0.6
const MAX_ZOOM = 2.2
/** Where a hand holds the wand, as a fraction of its length from the pommel. */
const GRIP = 0.2

// The box looks down on the wand; up close the camera looks straight at it.
// Turning the box's world about the wand's length by this much lines them up.
const BOX_TO_CLOSE = Math.PI / 2 - Math.atan(BOX_CAMERA_LEAN)

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

interface Flight {
  /** 0 lying in the box, 1 held up in the middle of the screen. */
  t: number
  direction: 1 | -1
  box: BoxPose
  lifted: boolean
  arrived: boolean
  landed: (() => void) | null
}

// Turning works like a pencil under a finger: a drag across the wand rolls it,
// a drag along it swings the tip towards or away from the viewer.
interface Handling {
  roll: number
  swing: number
  /** Turning carried on after a flick, in radians per second: x rolls, y swings. */
  spin: THREE.Vector2
  zoom: number
  grabbed: boolean
  /** Until the child first touches it, the wand rolls slowly by itself. */
  touched: boolean
  /** How far the held wand leans from level on screen, so drags can be read along and across it. */
  tilt: number
  /** Clock time the latest wave began, or null when the wand isn't waving. */
  waveAt: number | null
}

function Rig({
  spec,
  flight,
  handling,
  reducedMotion,
  events,
  hit,
  children,
}: {
  spec: WandSpec
  flight: RefObject<Flight>
  handling: RefObject<Handling>
  reducedMotion: boolean
  events: RefObject<{ onLift: () => void; onArrive: () => void }>
  hit: RefObject<THREE.Mesh | null>
  children: ReactNode
}) {
  const wand = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const tip = useRef(new THREE.Vector3())
  const streaking = useRef(false)
  const q = useMemo(
    () => ({
      from: new THREE.Quaternion(),
      held: new THREE.Quaternion(),
      step: new THREE.Quaternion(),
      wave: new THREE.Quaternion(),
    }),
    [],
  )
  const v = useMemo(
    () => ({
      grip: new THREE.Vector3(),
      moved: new THREE.Vector3(),
      across: new THREE.Vector3(),
      reach: new THREE.Vector3(),
      held: new THREE.Vector3(),
    }),
    [],
  )

  useFrame(({ size, clock, camera }, delta) => {
    const f = flight.current
    const h = handling.current
    const dt = Math.min(delta, 0.05)
    if (!f.lifted) {
      // The first frame draws the wand where it lay; it only starts to move once the box is empty.
      f.lifted = true
      events.current.onLift()
    } else f.t = clamp(f.t + f.direction * (reducedMotion ? 1 : dt / RISE_SECONDS), 0, 1)
    if (f.t === 1 && !f.arrived) {
      f.arrived = true
      events.current.onArrive()
    }
    if (f.t === 0 && f.landed) {
      f.landed()
      f.landed = null
    }

    const held = f.t === 1 && f.direction === 1
    if (held && !h.touched && !reducedMotion) h.roll += dt * IDLE_ROLL_PER_SECOND
    if (held && !h.grabbed && h.spin.lengthSq() > 0) {
      h.roll += h.spin.x * dt
      h.swing += h.spin.y * dt
      h.spin.multiplyScalar(Math.exp(-4 * dt))
      if (h.spin.lengthSq() < 1e-4) h.spin.set(0, 0)
    }

    // Pixels per scene unit on the plane through the wand.
    const px = size.height / (2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360))
    const { rect, turns } = f.box
    const roll = turns * Math.PI * 2
    const boxPx = rect.width / 2 / ((LONGEST_WAND_MM * MM) / 2 / STAGE_FILL)

    const portrait = size.height > size.width
    const tilt = portrait ? Math.PI * 0.4 : Math.PI * 0.05
    h.tilt = tilt
    const length = spec.lengthMm * MM * px
    const heldScale = Math.min(
      (0.76 * size.width) / (length * Math.abs(Math.cos(tilt))),
      (0.56 * size.height) / (length * Math.abs(Math.sin(tilt))),
    )

    q.from.setFromAxisAngle(X, BOX_TO_CLOSE + roll)
    q.held
      .setFromAxisAngle(X, Math.PI / 2 + roll + h.roll)
      .premultiply(q.step.setFromAxisAngle(Y, h.swing))
      .premultiply(q.step.setFromAxisAngle(Z, tilt))

    const sinceWave = h.waveAt === null ? Infinity : clock.elapsedTime - h.waveAt
    const waving = held && !reducedMotion && sinceWave < WAVE_SECONDS
    const wave = waving ? wavePose(sinceWave) : null
    streaking.current = wave?.trail ?? false
    if (!waving) h.waveAt = null

    const e = easeInOut(f.t)
    const g = wand.current
    if (g) {
      g.position.set(
        lerp((rect.left + rect.width / 2 - size.left - size.width / 2) / px, 0, e),
        lerp(
          -(rect.top + rect.height / 2 - size.top - size.height / 2) / px,
          (0.1 * size.height) / px,
          e,
        ),
        0,
      )
      g.scale.setScalar(lerp(boxPx / px, heldScale * h.zoom, e))
      g.quaternion.copy(q.from).slerp(q.held, e)
      if (wave) {
        // Turn about the hand on the grip.
        const length = spec.lengthMm * MM * g.scale.x
        v.grip
          .set(1, 0, 0)
          .applyQuaternion(g.quaternion)
          .multiplyScalar((GRIP - 0.5) * length)
        v.reach.set(1, 0, 0).applyQuaternion(g.quaternion)
        v.reach.multiplyScalar((1 - GRIP) * length + 0.03 * g.scale.x)
        v.across.set(-Math.sin(tilt), Math.cos(tilt), 0)
        const fit = fitWave(camera, v.held.copy(g.position).add(v.grip), v.reach, v.across)
        waveTurn(wave, v.across, fit, q.wave)
        g.quaternion.premultiply(q.wave)
        v.moved.copy(v.grip).applyQuaternion(q.wave)
        g.position.add(v.grip).sub(v.moved)
      }
      g.updateMatrixWorld()
      tip.current.set((spec.lengthMm / 2) * MM + 0.03, 0, 0).applyMatrix4(g.matrixWorld)
    }
    if (lights.current) lights.current.rotation.x = BOX_TO_CLOSE * (1 - e)
    // The rim outlines the wand in the box; up close it glances off a wand aimed into the scene and turns it silver.
    if (rim.current) rim.current.intensity = RIM_INTENSITY * (1 - e)
  })

  const girth = spec.handleMaxR * 2 * MM * 3.5
  return (
    <>
      <group ref={lights}>
        <ShopLights rim={rim} />
      </group>
      <group ref={wand}>
        {children}
        <mesh ref={hit} visible={false}>
          <boxGeometry args={[spec.lengthMm * MM * 1.1, girth, girth]} />
        </mesh>
      </group>
      <WaveTrail colour={spec.spell} tip={tip} emitting={streaking} />
    </>
  )
}

function Bridge({ handle }: { handle: { current: RootState | null } }) {
  handle.current = useThree()
  return null
}

export function CloseUpStage({
  params,
  reducedMotion,
  boxPose,
  onLift,
  onArrive,
  onTapWand,
  onTapAway,
  ref,
}: CloseUpProps) {
  const spec = useMemo(() => compileWand(params), [params])
  const [castAt, setCastAt] = useState<number | null>(null)
  const three = useRef<RootState | null>(null)
  const hit = useRef<THREE.Mesh | null>(null)
  const events = useRef({ onLift, onArrive })
  events.current = { onLift, onArrive }
  const [flight] = useState<{ current: Flight }>(() => ({
    current: { t: 0, direction: 1, box: boxPose(), lifted: false, arrived: false, landed: null },
  }))
  const [handling] = useState<{ current: Handling }>(() => ({
    current: {
      roll: 0,
      swing: 0,
      spin: new THREE.Vector2(),
      zoom: 1,
      grabbed: false,
      touched: false,
      tilt: 0,
      waveAt: null,
    },
  }))
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ travelled: 0, pinched: false, lastMove: 0 })

  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      cast: () => {
        const now = three.current?.clock.elapsedTime ?? 0
        handling.current.waveAt = now
        setCastAt(now + (reducedMotion ? 0 : WAVE_TO_SPELL_SECONDS))
      },
      putBack: () =>
        new Promise((resolve) => {
          flight.current.box = boxPose()
          flight.current.direction = -1
          flight.current.landed = resolve
        }),
    }),
    [boxPose, reducedMotion],
  )

  const landsOnWand = (clientX: number, clientY: number) => {
    const state = three.current
    if (!state || !hit.current) return false
    const { size, camera, raycaster } = state
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - size.left) / size.width) * 2 - 1,
        -((clientY - size.top) / size.height) * 2 + 1,
      ),
      camera,
    )
    return raycaster.intersectObject(hit.current, false).length > 0
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1)
      gesture.current = { travelled: 0, pinched: false, lastMove: e.timeStamp }
    else gesture.current.pinched = true
    handling.current.grabbed = true
    handling.current.spin.set(0, 0)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    const h = handling.current
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [typeof last, typeof last]
      const before = Math.hypot(a.x - b.x, a.y - b.y)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [c, d] = [...pointers.current.values()] as [typeof last, typeof last]
      const after = Math.hypot(c.x - d.x, c.y - d.y)
      if (before > 0) h.zoom = clamp(h.zoom * (after / before), MIN_ZOOM, MAX_ZOOM)
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    g.travelled += Math.hypot(dx, dy)
    if (g.travelled <= TAP_SLOP_PX || g.pinched) return
    h.touched = true
    const along = (dx * Math.cos(h.tilt) - dy * Math.sin(h.tilt)) * TURN_PER_PX
    const across = (dx * Math.sin(h.tilt) + dy * Math.cos(h.tilt)) * TURN_PER_PX
    h.roll += across
    h.swing += along
    const seconds = Math.max((e.timeStamp - g.lastMove) / 1000, 1 / 120)
    h.spin.set(across / seconds, along / seconds)
    g.lastMove = e.timeStamp
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    handling.current.grabbed = pointers.current.size > 0
    const g = gesture.current
    // A pause before letting go means no flick.
    if (e.timeStamp - g.lastMove > 80) handling.current.spin.set(0, 0)
    if (pointers.current.size > 0 || g.pinched || g.travelled > TAP_SLOP_PX) return
    if (landsOnWand(e.clientX, e.clientY)) onTapWand()
    else onTapAway()
  }

  return (
    <div
      className={styles.stage}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        handling.current.grabbed = pointers.current.size > 0
        gesture.current.pinched = true
      }}
      onWheel={(e) => {
        const h = handling.current
        h.zoom = clamp(h.zoom * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
      }}
    >
      <Canvas
        camera={{ fov: FOV, near: 0.1, far: 50, position: [0, 0, CAMERA_DISTANCE] }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Bridge handle={three} />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio.hdr" environmentIntensity={0.45} />
          <Rig
            spec={spec}
            flight={flight}
            handling={handling}
            reducedMotion={reducedMotion}
            events={events}
            hit={hit}
          >
            <WandMesh spec={spec} castAt={castAt} reducedMotion={reducedMotion} />
          </Rig>
        </Suspense>
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1.4} intensity={1.1} radius={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
