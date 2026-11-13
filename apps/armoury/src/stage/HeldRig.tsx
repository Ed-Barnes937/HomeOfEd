import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import {
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import * as THREE from 'three'

import { Bridge } from './boxRig.tsx'
import styles from './HeldRig.module.scss'
import {
  dragUpright,
  heldTilt,
  rightUpright,
  uprightFlourishWeight,
  type Hold,
  type UprightPose,
} from './hold.ts'
import { BOX_CAMERA_LEAN, FOV, FRONT_CAMERA_PITCH, MM } from './scene.tsx'
import type { BoxPose, CloseUpHandle, CloseUpProps } from './stage.ts'
import { fitWave, WAVE_SECONDS, wavePose, waveTurn } from './wave.ts'
import { WaveTrail } from './WaveTrail.tsx'

const CAMERA_DISTANCE = 8
const RISE_SECONDS = 0.8
const TAP_SLOP_PX = 6
const TURN_PER_PX = 0.007
const IDLE_ROLL_PER_SECOND = 0.35
const MIN_ZOOM = 0.6
const MAX_ZOOM = 2.2

// The box looks down on the item; up close the camera looks straight at it.
// Turning the box's world about the item's length by this much lines them up.
const BOX_TO_CLOSE = Math.PI / 2 - Math.atan(BOX_CAMERA_LEAN)

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** What the rig needs to know about the item it lifts. Points are in the item's own space, along z, before it is turned to lie along x. */
export interface HeldItem {
  lengthMm: number
  /** Where the trail streams from. */
  tip: [number, number, number]
  /** The invisible box a tap must land in, in scene units, lying along x. */
  hit: [number, number, number]
  /** Where a hand holds it, as a fraction of its length from the pommel. */
  grip: number
  /** Stretches the figure of 8 in time; 1 is the wand's. */
  flourishScale: number
  trailColour: string | null
  /** The box stage's half width in scene units, so the item starts the size it lay in its box. */
  boxHalfWidth: number
  /** Held level like a wand (the default), or standing up, leaning and tipping under a finger. */
  hold?: Hold
  /** `'own'`: no figure of 8 or trail; the children draw the flourish from `flourishAt`. */
  flourish?: 'wave' | 'own'
  /** How long an `'own'` flourish lasts; an upright item is held upright for it. */
  flourishSeconds?: number
  /**
   * How the box stage looks at the item: from above (the default), or from the front pitched down by
   * `FRONT_CAMERA_PITCH`, with the item stood up a quarter turn about z and rolled about y if upright.
   */
  boxView?: 'above' | 'front'
  /** The widest across, so an upright item fits the screen by its width as well as its height. */
  widthMm?: number
}

interface Flight {
  /** 0 lying in the box, 1 held up in the middle of the screen. */
  t: number
  direction: 1 | -1
  box: BoxPose
  lifted: boolean
  arrived: boolean
  landed: (() => void) | null
}

// Turning works like a pencil under a finger: a drag across the item rolls it,
// a drag along it swings the tip towards or away from the viewer.
interface Handling {
  roll: number
  swing: number
  /** Turning carried on after a flick, in radians per second: x rolls, y swings. */
  spin: THREE.Vector2
  zoom: number
  grabbed: boolean
  /** Until the child first touches it, the item rolls slowly by itself. */
  touched: boolean
  /** How far the held item leans from level on screen, so drags can be read along and across it. */
  tilt: number
  /** Clock time the latest flourish began, or null when the item isn't moving through one. */
  waveAt: number | null
  /** An upright item's lean and tip, which right themselves once let go. */
  upright: UprightPose
}

type Lights = ComponentType<{ rim?: Ref<THREE.DirectionalLight> }>

function Rig({
  item,
  Lights,
  rimIntensity,
  flight,
  handling,
  reducedMotion,
  events,
  hit,
  children,
}: {
  item: HeldItem
  Lights: Lights
  rimIntensity: number
  flight: RefObject<Flight>
  handling: RefObject<Handling>
  reducedMotion: boolean
  events: RefObject<{ onLift: () => void; onArrive: () => void }>
  hit: RefObject<THREE.Mesh | null>
  children: ReactNode
}) {
  const held = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const tip = useRef(new THREE.Vector3())
  const tipAt = item.tip
  const streaking = useRef(false)
  const q = useMemo(
    () => ({
      from: new THREE.Quaternion(),
      held: new THREE.Quaternion(),
      step: new THREE.Quaternion(),
      wave: new THREE.Quaternion(),
      pose: new THREE.Quaternion(),
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
      // The first frame draws the item where it lay; it only starts to move once the box is empty.
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

    const isHeld = f.t === 1 && f.direction === 1
    if (isHeld && !h.touched && !reducedMotion) h.roll += dt * IDLE_ROLL_PER_SECOND
    if (isHeld && !h.grabbed && h.spin.lengthSq() > 0) {
      h.roll += h.spin.x * dt
      h.swing += h.spin.y * dt
      h.spin.multiplyScalar(Math.exp(-4 * dt))
      if (h.spin.lengthSq() < 1e-4) h.spin.set(0, 0)
    }
    const upright = item.hold === 'upright'
    const front = item.boxView === 'front'
    const own = item.flourish === 'own'
    if (upright && !h.grabbed) h.upright = rightUpright(h.upright, dt, reducedMotion)

    // Pixels per scene unit on the plane through the item.
    const px = size.height / (2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360))
    const { rect, turns } = f.box
    const roll = turns * Math.PI * 2
    const boxPx = rect.width / 2 / item.boxHalfWidth

    const portrait = size.height > size.width
    const tilt = heldTilt(item.hold ?? 'level', portrait)
    h.tilt = tilt
    const length = item.lengthMm * MM * px
    const width = (item.widthMm ?? 0) * MM * px
    const heldScale = upright
      ? Math.min(width > 0 ? (0.76 * size.width) / width : Infinity, (0.56 * size.height) / length)
      : Math.min(
          (0.76 * size.width) / (length * Math.abs(Math.cos(tilt))),
          (0.56 * size.height) / (length * Math.abs(Math.sin(tilt))),
        )

    // The box's camera is turned from the close look's about x; from the front, an upright item stands in its box.
    if (front)
      q.from
        .setFromAxisAngle(X, roll)
        .premultiply(q.step.setFromAxisAngle(Z, upright ? Math.PI / 2 : 0))
        .premultiply(q.step.setFromAxisAngle(X, FRONT_CAMERA_PITCH))
    else q.from.setFromAxisAngle(X, BOX_TO_CLOSE + roll)
    const facing = front ? 0 : Math.PI / 2
    q.held
      .setFromAxisAngle(X, facing + roll + h.roll)
      .premultiply(q.step.setFromAxisAngle(Y, h.swing))
      .premultiply(q.step.setFromAxisAngle(Z, tilt))

    const sinceWave = h.waveAt === null ? Infinity : clock.elapsedTime - h.waveAt
    const flourishSeconds = item.flourishSeconds ?? 0
    const waving = !own && isHeld && !reducedMotion && sinceWave < WAVE_SECONDS * item.flourishScale
    const wave = waving ? wavePose(sinceWave / item.flourishScale) : null
    streaking.current = wave?.trail ?? false
    const upheld = own && upright ? uprightFlourishWeight(sinceWave, flourishSeconds) : 0
    if (own ? !(sinceWave < flourishSeconds) : !waving) h.waveAt = null

    const e = easeInOut(f.t)
    const g = held.current
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
        const length = item.lengthMm * MM * g.scale.x
        v.grip
          .set(1, 0, 0)
          .applyQuaternion(g.quaternion)
          .multiplyScalar((item.grip - 0.5) * length)
        v.reach.set(1, 0, 0).applyQuaternion(g.quaternion)
        v.reach.multiplyScalar((1 - item.grip) * length + 0.03 * g.scale.x)
        v.across.set(-Math.sin(tilt), Math.cos(tilt), 0)
        const fit = fitWave(camera, v.held.copy(g.position).add(v.grip), v.reach, v.across)
        waveTurn(wave, v.across, fit, q.wave)
        g.quaternion.premultiply(q.wave)
        v.moved.copy(v.grip).applyQuaternion(q.wave)
        g.position.add(v.grip).sub(v.moved)
      }
      const pose = h.upright
      const shown = e * (1 - upheld)
      if (upright && shown > 0 && (pose.lean !== 0 || pose.tip !== 0)) {
        // Tip and lean in screen space, about the hand on the grip.
        const length = item.lengthMm * MM * g.scale.x
        v.grip
          .set(1, 0, 0)
          .applyQuaternion(g.quaternion)
          .multiplyScalar((item.grip - 0.5) * length)
        q.pose
          .setFromAxisAngle(X, pose.tip * shown)
          .premultiply(q.step.setFromAxisAngle(Z, -pose.lean * shown))
        g.quaternion.premultiply(q.pose)
        v.moved.copy(v.grip).applyQuaternion(q.pose)
        g.position.add(v.grip).sub(v.moved)
      }
      g.updateMatrixWorld()
      // The item's group lies along x: its own (x, y, z) is turned to (z, y, -x).
      tip.current.set(tipAt[2], tipAt[1], -tipAt[0]).applyMatrix4(g.matrixWorld)
    }
    if (lights.current)
      lights.current.rotation.x = (front ? FRONT_CAMERA_PITCH : BOX_TO_CLOSE) * (1 - e)
    // The rim outlines the item in the box; up close it glances off an item aimed into the scene and turns it silver.
    if (rim.current) rim.current.intensity = rimIntensity * (1 - e)
  })

  return (
    <>
      <group ref={lights}>
        <Lights rim={rim} />
      </group>
      <group ref={held}>
        {children}
        <mesh ref={hit} visible={false}>
          <boxGeometry args={item.hit} />
        </mesh>
      </group>
      {item.trailColour !== null && (
        <WaveTrail colour={item.trailColour} tip={tip} emitting={streaking} />
      )}
    </>
  )
}

export type HeldRigProps = Omit<CloseUpProps, 'params'> & {
  item: HeldItem
  /** The item's lights, in the box's frame; the rig turns them as the item rises and fades `rim` out. */
  Lights: Lights
  rimIntensity: number
  environment: ReactNode
  effects: ReactNode
  /** Draws the item, given the clock time the latest flourish began, or null. */
  children: (flourishAt: number | null) => ReactNode
}

/** The close look: lifts the item out of its box, lets a child turn and zoom it, and flies it back. */
export function HeldRig({
  item,
  Lights,
  rimIntensity,
  environment,
  effects,
  reducedMotion,
  boxPose,
  onLift,
  onArrive,
  onTapItem,
  onTapAway,
  ref,
  children,
}: HeldRigProps) {
  const [flourishAt, setFlourishAt] = useState<number | null>(null)
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
      upright: { lean: 0, tip: 0, leanVelocity: 0, tipVelocity: 0 },
    },
  }))
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ travelled: 0, pinched: false, lastMove: 0 })

  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      flourish: () => {
        const now = three.current?.clock.elapsedTime ?? 0
        handling.current.waveAt = now
        setFlourishAt(now)
      },
      putBack: () =>
        new Promise((resolve) => {
          flight.current.box = boxPose()
          flight.current.direction = -1
          flight.current.landed = resolve
        }),
    }),
    [boxPose],
  )

  const landsOnItem = (clientX: number, clientY: number) => {
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
    if (item.hold === 'upright') {
      h.upright = dragUpright(h.upright, dx, dy)
      g.lastMove = e.timeStamp
      return
    }
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
    if (landsOnItem(e.clientX, e.clientY)) onTapItem()
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
          {environment}
          <Rig
            item={item}
            Lights={Lights}
            rimIntensity={rimIntensity}
            flight={flight}
            handling={handling}
            reducedMotion={reducedMotion}
            events={events}
            hit={hit}
          >
            {children(flourishAt)}
          </Rig>
        </Suspense>
        {effects}
      </Canvas>
    </div>
  )
}
