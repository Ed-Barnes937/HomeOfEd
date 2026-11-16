import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

// Dev-only, for the GPU gate shots: publishes how far into the latest flourish the stage is, on its own clock,
// and on request holds the whole stage still at an exact moment of the flourish until the shot is taken.
export const PROBE = import.meta.env.DEV

interface Probe {
  sinceFlourish?: number | null
  /** How long the item's own flourish lasts, when it has one. */
  flourishSeconds?: number | null
  /** Set by the shots script: the moment, in seconds into the flourish, to hold at. */
  holdFlourishAt?: number | null
  /** The moment the stage is held at, once that frame is drawn. */
  heldFlourishAt?: number | null
  resumeFlourish?: () => void
  /** Seconds of motion the stage has stepped, each frame's time capped at 0.05 s as the rig and the slosh cap it. */
  motionClock?: number
  /** Set by the shots script: a moment on the motion clock to hold at, flourish or not. */
  holdMotionAt?: number | null
  heldMotionAt?: number | null
}

export function FlourishProbe({ at, seconds }: { at: number | null; seconds?: number }) {
  const get = useThree((state) => state.get)
  useEffect(() => {
    const probe = window as Window & Probe
    probe.resumeFlourish = () => {
      const state = get()
      state.clock.oldTime = performance.now()
      probe.heldFlourishAt = null
      probe.heldMotionAt = null
      state.internal.active = true
      state.invalidate()
    }
  }, [get])
  // Runs before every other reader of the clock, so the rig's pose, the glow and the presenting turn all see the held moment.
  const motion = useRef(0)
  useFrame(({ clock }, delta) => {
    const probe = window as Window & Probe
    motion.current += Math.min(delta, 0.05)
    const hold = probe.holdFlourishAt
    const stopAfterThisFrame = (held: () => void) => {
      const stop = addAfterEffect(() => {
        stop()
        get().internal.active = false
        held()
      })
    }
    if (at !== null && typeof hold === 'number' && clock.elapsedTime - at >= hold) {
      clock.elapsedTime = at + hold
      probe.holdFlourishAt = null
      stopAfterThisFrame(() => (probe.heldFlourishAt = hold))
    }
    const holdMotion = probe.holdMotionAt
    if (typeof holdMotion === 'number' && motion.current >= holdMotion) {
      probe.holdMotionAt = null
      const held = motion.current
      stopAfterThisFrame(() => (probe.heldMotionAt = held))
    }
    probe.sinceFlourish = at === null ? null : clock.elapsedTime - at
    probe.flourishSeconds = seconds ?? null
    probe.motionClock = motion.current
  }, -1)
  return null
}
