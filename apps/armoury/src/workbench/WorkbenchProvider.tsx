import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'

import { normalise } from '../engine/schema.ts'
import type { StoredWand } from '../persistence/saveFormat.ts'
import {
  keepWand,
  loadSaveDocument,
  removeWand,
  renameWand,
  writeWorkingWand,
  type SaveStorage,
} from '../persistence/storage.ts'
import { clearShareHash, decodeShareHash } from '../share/shareLink.ts'
import { wandPresets } from '../wand/presets.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import { startWorkbench, workbench, type Workbench, type WorkbenchAction } from './workbench.ts'

const AUTOSAVE_MS = 400

export interface WorkbenchContextValue {
  state: Workbench
  dispatch: Dispatch<WorkbenchAction>
  shelf: readonly StoredWand[]
  keep: (wand: StoredWand) => void
  renameOnShelf: (index: number, name: string) => void
  removeFromShelf: (index: number) => void
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function firstVisitWand(): StoredWand {
  return { params: normalise(wandSchema, wandPresets[0]!.params) }
}

function initialWand(storage: SaveStorage): StoredWand {
  return (
    decodeShareHash(window.location.hash) ?? loadSaveDocument(storage).working ?? firstVisitWand()
  )
}

export function WorkbenchProvider({
  storage = window.localStorage,
  children,
}: {
  storage?: SaveStorage
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(workbench, storage, (s) => startWorkbench(initialWand(s)))
  const [shelf, setShelf] = useState(() => loadSaveDocument(storage).shelf)

  useEffect(() => {
    if (decodeShareHash(window.location.hash)) clearShareHash(window.location, window.history)
  }, [])

  const latest = useRef(state.wand)
  latest.current = state.wand
  useEffect(() => {
    const timer = setTimeout(() => writeWorkingWand(storage, state.wand), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [storage, state.wand])
  useEffect(() => {
    const flush = () => writeWorkingWand(storage, latest.current)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [storage])

  const refresh = useCallback(() => setShelf(loadSaveDocument(storage).shelf), [storage])
  const keep = useCallback(
    (wand: StoredWand) => {
      keepWand(storage, wand)
      refresh()
    },
    [storage, refresh],
  )
  const renameOnShelf = useCallback(
    (index: number, name: string) => {
      renameWand(storage, index, name)
      refresh()
    },
    [storage, refresh],
  )
  const removeFromShelf = useCallback(
    (index: number) => {
      removeWand(storage, index)
      refresh()
    },
    [storage, refresh],
  )

  const value = useMemo(
    () => ({ state, dispatch, shelf, keep, renameOnShelf, removeFromShelf }),
    [state, shelf, keep, renameOnShelf, removeFromShelf],
  )
  return <WorkbenchContext value={value}>{children}</WorkbenchContext>
}

export function useWorkbench(): WorkbenchContextValue {
  const value = useContext(WorkbenchContext)
  if (!value) throw new Error('useWorkbench needs a WorkbenchProvider')
  return value
}
