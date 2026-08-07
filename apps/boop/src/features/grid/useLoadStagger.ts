import { useRef } from 'react'

/** Preset-load stagger (design handoff, "Motion" — "Preset load"): 24ms per column. */
export const PRESET_LOAD_STAGGER_MS = 24

/**
 * Per-cell animation delays for the preset-load stagger (ticket 22), shared by
 * the desktop grid and the phone grid.
 *
 * `loadToken` is bumped by the caller on every preset load (blank included),
 * so `isFreshLoad` is true for exactly the one render that processes it — a
 * documented React pattern (deriving from a prop change during render, without
 * an Effect). The delay map then makes that one-render signal "stick" for each
 * cell's whole on-streak: recorded the moment a cell turns on during a fresh
 * load, kept stable across later re-renders (e.g. playhead ticks) so the
 * animation isn't cut short, and cleared the moment the cell turns off so a
 * later manual edit of the same cell never inherits a stale delay.
 */
export function useLoadStagger(loadToken: number): (cellKey: string, step: number, isOn: boolean) => number {
  const lastLoadToken = useRef(loadToken)
  const isFreshLoad = loadToken !== lastLoadToken.current
  lastLoadToken.current = loadToken
  const delays = useRef(new Map<string, number>())

  return (cellKey, step, isOn) => {
    if (!isOn) {
      delays.current.delete(cellKey)
      return 0
    }
    if (!delays.current.has(cellKey)) {
      delays.current.set(cellKey, isFreshLoad ? step * PRESET_LOAD_STAGGER_MS : 0)
    }
    return delays.current.get(cellKey) ?? 0
  }
}
