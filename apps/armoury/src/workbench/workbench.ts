import { normalise, randomise, seededRandom, type ParamValue } from '../engine/schema.ts'
import type { ItemDef, StoredItem } from '../items/item.ts'

export interface Workbench {
  item: StoredItem
  /** The item "Try another" replaced, until something else changes. */
  previous: StoredItem | null
  /** Schema groups "Try another" leaves alone. */
  locked: readonly string[]
  /** Counts items arriving on the counter, so the box can play its entrance. */
  arrivals: number
}

export type WorkbenchAction =
  | { type: 'set'; key: string; value: ParamValue }
  | { type: 'tryAnother'; seed: number }
  | { type: 'putBack' }
  | { type: 'toggleLock'; group: string }
  | { type: 'rename'; name: string }
  | { type: 'load'; item: StoredItem }

export function startWorkbench(item: StoredItem): Workbench {
  return { item, previous: null, locked: [], arrivals: 0 }
}

/** The reducer for one kind of item: its schema, what it keeps and what follows a change. */
export function createWorkbench(def: ItemDef) {
  return function workbench(state: Workbench, action: WorkbenchAction): Workbench {
    switch (action.type) {
      case 'set': {
        const params = normalise(def.schema, {
          ...state.item.params,
          [action.key]: action.value,
          ...def.follows?.(state.item.params, action.key, action.value),
        })
        return { ...state, item: { ...state.item, params }, previous: null }
      }
      case 'tryAnother': {
        const params = randomise(def.schema, seededRandom(action.seed), {
          keep: state.item.params,
          locked: [...state.locked, ...def.keeps],
        })
        return { ...state, item: { params }, previous: state.item, arrivals: state.arrivals + 1 }
      }
      case 'putBack':
        if (!state.previous) return state
        return { ...state, item: state.previous, previous: null, arrivals: state.arrivals + 1 }
      case 'toggleLock': {
        const locked = state.locked.includes(action.group)
          ? state.locked.filter((g) => g !== action.group)
          : [...state.locked, action.group]
        return { ...state, locked }
      }
      case 'rename': {
        const name = action.name.trim()
        const { params } = state.item
        return { ...state, item: name === '' ? { params } : { params, name } }
      }
      case 'load':
        return { ...state, item: action.item, previous: null, arrivals: state.arrivals + 1 }
    }
  }
}
