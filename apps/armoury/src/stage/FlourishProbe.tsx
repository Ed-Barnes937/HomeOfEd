import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

// Dev-only, for the GPU gate shots: publishes how far into the latest flourish the stage is, on its own clock,
// and on request holds the whole stage still at an exact moment of the flourish until the shot is taken.
export const PROBE = import.meta.env.DEV

interface Probe {
  sinceFlourish?: number | null
  /** Set by the shots script: the moment, in seconds into the flourish, to hold at. */
  holdFlourishAt?: number | null
  /** The moment the stage is held at, once that frame is drawn. */
  heldFlourishAt?: number | null
  resumeFlourish?: () => void
}

export function FlourishProbe({ at }: { at: number | null }) {
  const get = useThree((state) => state.get)
  useEffect(() => {
    const probe = window as Window & Probe
    probe.resumeFlourish = () => {
      const state = get()
      state.clock.oldTime = performance.now()
      probe.heldFlourishAt = null
      state.internal.active = true
      state.invalidate()
    }
  }, [get])
  // Runs before every other reader of the clock, so the rig's pose, the glow and the presenting turn all see the held moment.
  useFrame(({ clock }) => {
    const probe = window as Window & Probe
    const hold = probe.holdFlourishAt
    if (at !== null && typeof hold === 'number' && clock.elapsedTime - at >= hold) {
      clock.elapsedTime = at + hold
      probe.holdFlourishAt = null
      const stop = addAfterEffect(() => {
        stop()
        get().internal.active = false
        probe.heldFlourishAt = hold
      })
    }
    probe.sinceFlourish = at === null ? null : clock.elapsedTime - at
  }, -1)
  return null
}
