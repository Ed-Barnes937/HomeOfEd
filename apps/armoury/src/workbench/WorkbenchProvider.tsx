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

import type { ItemDef, ItemKind, StoredItem } from '../items/item.ts'
import { ITEMS } from '../items/registry.ts'
import {
  keepItem,
  loadSaveDocument,
  removeItem,
  renameItem,
  writeWorking,
  type SaveStorage,
} from '../persistence/storage.ts'
import { clearShareHash, decodeShareHash, type SharedItem } from '../share/shareLink.ts'
import {
  createWorkbench,
  startWorkbench,
  type Workbench,
  type WorkbenchAction,
} from './workbench.ts'

const AUTOSAVE_MS = 400

/** One kind's counter and shelf. */
export interface Bench {
  state: Workbench
  dispatch: Dispatch<WorkbenchAction>
  shelf: readonly StoredItem[]
  keep: (item: StoredItem) => void
  renameOnShelf: (index: number, name: string) => void
  removeFromShelf: (index: number) => void
}

const WorkbenchContext = createContext<Record<ItemKind, Bench> | null>(null)

function initialItem(def: ItemDef, storage: SaveStorage, arrival: SharedItem | null): StoredItem {
  const arrived = arrival?.kind === def.kind ? arrival.item : null
  return arrived ?? loadSaveDocument(storage, def).working ?? { params: def.firstVisit() }
}

function useBench(def: ItemDef, storage: SaveStorage, arrival: SharedItem | null): Bench {
  const reducer = useMemo(() => createWorkbench(def), [def])
  const [state, dispatch] = useReducer(reducer, null, () =>
    startWorkbench(initialItem(def, storage, arrival)),
  )
  const [shelf, setShelf] = useState(() => loadSaveDocument(storage, def).shelf)

  const latest = useRef(state.item)
  latest.current = state.item
  useEffect(() => {
    const timer = setTimeout(() => writeWorking(storage, def, state.item), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [storage, def, state.item])
  useEffect(() => {
    const flush = () => writeWorking(storage, def, latest.current)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [storage, def])

  const refresh = useCallback(() => setShelf(loadSaveDocument(storage, def).shelf), [storage, def])
  const keep = useCallback(
    (item: StoredItem) => {
      keepItem(storage, def, item)
      refresh()
    },
    [storage, def, refresh],
  )
  const renameOnShelf = useCallback(
    (index: number, name: string) => {
      renameItem(storage, def, index, name)
      refresh()
    },
    [storage, def, refresh],
  )
  const removeFromShelf = useCallback(
    (index: number) => {
      removeItem(storage, def, index)
      refresh()
    },
    [storage, def, refresh],
  )

  return useMemo(
    () => ({ state, dispatch, shelf, keep, renameOnShelf, removeFromShelf }),
    [state, shelf, keep, renameOnShelf, removeFromShelf],
  )
}

export function WorkbenchProvider({
  storage = window.localStorage,
  children,
}: {
  storage?: SaveStorage
  children: ReactNode
}) {
  const [arrival] = useState(() => decodeShareHash(window.location.hash))
  const wand = useBench(ITEMS.wand, storage, arrival)
  const sword = useBench(ITEMS.sword, storage, arrival)

  useEffect(() => {
    if (arrival) clearShareHash(window.location, window.history)
  }, [arrival])

  const benches = useMemo(() => ({ wand, sword }), [wand, sword])
  return <WorkbenchContext value={benches}>{children}</WorkbenchContext>
}

export function useWorkbench(kind: ItemKind): Bench {
  const bench = useContext(WorkbenchContext)?.[kind]
  if (!bench) throw new Error(`useWorkbench needs a WorkbenchProvider with a ${kind} bench`)
  return bench
}
