import { normalise, randomise, seededRandom, type ParamValue } from '../engine/schema.ts'
import type { StoredWand } from '../persistence/saveFormat.ts'
import { wandSchema } from '../wand/wandSchema.ts'

export interface Workbench {
  wand: StoredWand
  /** The wand "Try another" replaced, until something else changes. */
  previous: StoredWand | null
  /** Schema groups "Try another" leaves alone. */
  locked: readonly string[]
  /** Counts wands arriving on the counter, so the box can play its entrance. */
  arrivals: number
}

export type WorkbenchAction =
  | { type: 'set'; key: string; value: ParamValue }
  | { type: 'tryAnother'; seed: number }
  | { type: 'putBack' }
  | { type: 'toggleLock'; group: string }
  | { type: 'rename'; name: string }
  | { type: 'load'; wand: StoredWand }

export function startWorkbench(wand: StoredWand): Workbench {
  return { wand, previous: null, locked: [], arrivals: 0 }
}

export function workbench(state: Workbench, action: WorkbenchAction): Workbench {
  switch (action.type) {
    case 'set': {
      // A wand just made a Branch starts with some bark; a saved one keeps what it had.
      const newBranch =
        action.key === 'kind' && action.value === 'branch' && state.wand.params.kind !== 'branch'
      const params = normalise(wandSchema, {
        ...state.wand.params,
        [action.key]: action.value,
        ...(newBranch ? { bark: 'patches' } : {}),
      })
      return { ...state, wand: { ...state.wand, params }, previous: null }
    }
    case 'tryAnother': {
      const params = randomise(wandSchema, seededRandom(action.seed), {
        keep: state.wand.params,
        // Try another rolls a new wand of the same kind.
        locked: [...state.locked, 'kind'],
      })
      return { ...state, wand: { params }, previous: state.wand, arrivals: state.arrivals + 1 }
    }
    case 'putBack':
      if (!state.previous) return state
      return { ...state, wand: state.previous, previous: null, arrivals: state.arrivals + 1 }
    case 'toggleLock': {
      const locked = state.locked.includes(action.group)
        ? state.locked.filter((g) => g !== action.group)
        : [...state.locked, action.group]
      return { ...state, locked }
    }
    case 'rename': {
      const name = action.name.trim()
      const { params } = state.wand
      return { ...state, wand: name === '' ? { params } : { params, name } }
    }
    case 'load':
      return { ...state, wand: action.wand, previous: null, arrivals: state.arrivals + 1 }
  }
}
