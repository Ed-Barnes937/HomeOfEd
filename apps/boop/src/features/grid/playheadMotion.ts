import type { BeatEvent } from '../../engine/sequencerEngine.ts'

const GROUP_SIZE = 4

/** Which 4-step group — a bar, per the design handoff's bar-numeral row — a step falls in. */
export function stepToBar(step: number): number {
  return Math.floor(step / GROUP_SIZE)
}

/** A step's position within its bar (0-3) — the playhead column's horizontal slot in the group. */
export function stepToCol(step: number): number {
  return step % GROUP_SIZE
}

export interface PlayheadState {
  /** The last drawn step, or `null` before the first drawn beat. */
  step: number | null
  /** `${instrumentId}:${step}` -> times struck there; a cell's squash re-key only on a real hit. */
  cellStrikes: Readonly<Record<string, number>>
  /** `instrumentId` -> times struck in that row; drives the row-label bob. */
  rowStrikes: Readonly<Record<string, number>>
}

export const INITIAL_PLAYHEAD_STATE: PlayheadState = { step: null, cellStrikes: {}, rowStrikes: {} }

/**
 * Fold one drawn beat event into playhead state. Pure, so the strike-counting
 * logic is unit-testable without an engine or a DOM — the hook that consumes
 * `onDrawBeat` (`usePlayheadMotion.ts`) is just this reducer plus subscriptions.
 */
export function applyDrawBeat(state: PlayheadState, event: BeatEvent): PlayheadState {
  if (event.hits.length === 0) return { ...state, step: event.step }

  const cellStrikes = { ...state.cellStrikes }
  const rowStrikes = { ...state.rowStrikes }
  for (const hit of event.hits) {
    const cellKey = `${hit.instrumentId}:${event.step}`
    cellStrikes[cellKey] = (cellStrikes[cellKey] ?? 0) + 1
    rowStrikes[hit.instrumentId] = (rowStrikes[hit.instrumentId] ?? 0) + 1
  }
  return { step: event.step, cellStrikes, rowStrikes }
}
