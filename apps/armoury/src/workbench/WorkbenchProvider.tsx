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
import { readLastShop, writeLastShop } from '../persistence/lastShop.ts'
import {
  keepItem,
  loadSaveDocument,
  removeItem,
  renameItem,
  writeWorking,
  type SaveStorage,
} from '../persistence/storage.ts'
import type { SharedItem } from '../share/shareLink.ts'
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

/** The shop the child was in last, a device preference that `storage` passes through unscoped. */
export interface Shops {
  lastShop: ItemKind | null
  enterShop: (kind: ItemKind) => void
}

const ShopsContext = createContext<Shops | null>(null)

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
  storage,
  arrived,
  children,
}: {
  /** The player's `profileStorage`, or the shared view's `memoryStorage`. */
  storage: SaveStorage
  /** The item the page's link brought, read once at the app's entry. */
  arrived: SharedItem | null
  children: ReactNode
}) {
  const wand = useBench(ITEMS.wand, storage, arrived)
  const sword = useBench(ITEMS.sword, storage, arrived)
  const [lastShop, setLastShop] = useState(() => readLastShop(storage))

  const enterShop = useCallback(
    (kind: ItemKind) => {
      writeLastShop(storage, kind)
      setLastShop(kind)
    },
    [storage],
  )

  const benches = useMemo(() => ({ wand, sword }), [wand, sword])
  const shops = useMemo(() => ({ lastShop, enterShop }), [lastShop, enterShop])
  return (
    <ShopsContext value={shops}>
      <WorkbenchContext value={benches}>{children}</WorkbenchContext>
    </ShopsContext>
  )
}

export function useShops(): Shops {
  const shops = useContext(ShopsContext)
  if (!shops) throw new Error('useShops needs a WorkbenchProvider')
  return shops
}

export function useWorkbench(kind: ItemKind): Bench {
  const bench = useContext(WorkbenchContext)?.[kind]
  if (!bench) throw new Error(`useWorkbench needs a WorkbenchProvider with a ${kind} bench`)
  return bench
}
