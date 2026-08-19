import { useEffect, useState } from 'react'

import type { SequencerEngine } from '../../engine/sequencerEngine.ts'
import { applyDrawBeat, INITIAL_PLAYHEAD_STATE, type PlayheadState } from './playheadMotion.ts'

export interface PlayheadMotion extends PlayheadState {
  /** Whether the loop is running — the caller hides the playhead cleanly while this is false. */
  playing: boolean
}

/**
 * Drives the playhead column and hit-motion state from the engine's
 * draw-time channel only (`onDrawBeat`, never `onBeat`) — the strike-counting
 * itself is the pure `applyDrawBeat` reducer in `playheadMotion.ts`, so this
 * hook is just subscriptions plus `setState`, both safe at draw time.
 */
export function usePlayheadMotion(engine: SequencerEngine | null): PlayheadMotion {
  const [state, setState] = useState<PlayheadState>(INITIAL_PLAYHEAD_STATE)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!engine) return
    setPlaying(engine.isPlaying())
    const offTransport = engine.onTransport((event) => {
      if (event.type === 'started') {
        setPlaying(true)
        // A run never inherits the last one's step (ticket 22), so the step it
        // ended on must not flash before this run's first beat is drawn. A
        // scrubbed start is unaffected: that step is `scrubStep`, held by the
        // page until a drawn beat replaces it.
        setState((current) => ({ ...current, step: null }))
      }
      if (event.type === 'stopped') setPlaying(false)
    })
    const offDraw = engine.onDrawBeat((event) => setState((current) => applyDrawBeat(current, event)))
    return () => {
      offTransport()
      offDraw()
    }
  }, [engine])

  return { ...state, playing }
}
