import { memoryStorage } from '@hoe/accounts'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { FridgePage } from '../../pages/FridgePage.tsx'
import { BoardStorageProvider, useBoardStorage } from '../board/BoardStorageContext.tsx'
import { fromStoredBoard, saveState, type StoredBoard, toStoredBoard } from '../board/serialize.ts'
import { sharedBoardQueryOptions } from './boardApi.ts'
import { importSharedBoard } from './importSharedBoard.ts'
import { stashKeep, takeKeep } from './keepStash.ts'
import styles from './SharedBoardRoute.module.scss'

const sharedRoute = getRouteApi('/b/$id')
const keepRoute = getRouteApi('/_player/keep/$id')

/** Where Keep goes: a full navigation, so the server's gate sees it (ADR 0093). */
export const keepHrefFor = (id: string) => `/keep/${encodeURIComponent(id)}`

/**
 * `/b/$id`: open to anyone, and it keeps nothing (ADR 0093 decision 6). The
 * snapshot opens as a fridge to play with over memory storage; keeping it is
 * `/keep/$id`, behind the gate.
 */
export function SharedBoardRoute() {
  const { id } = sharedRoute.useParams()
  const query = useQuery(sharedBoardQueryOptions(id))

  if (query.isError) return <SharedNotFound />
  if (!query.isSuccess) return <SharedLoading label="Opening shared fridge…" />
  return <SharedFridge key={id} id={id} board={query.data} />
}

/** A board as `useFridgeBoard` stores it, so an untouched board compares equal. */
function asStored(board: StoredBoard): StoredBoard {
  const { magnets, finish, wall } = fromStoredBoard(board)
  return toStoredBoard(board.name, magnets, finish, wall)
}

function SharedFridge({ id, board }: { id: string; board: StoredBoard }) {
  const [storage] = useState(() => {
    const memory = memoryStorage()
    saveState(memory, board, [])
    return memory
  })
  return (
    <BoardStorageProvider storage={storage}>
      <FridgePage
        keepHref={keepHrefFor(id)}
        onKeep={(current) => {
          const edited = JSON.stringify(current) !== JSON.stringify(asStored(board))
          stashKeep(window.sessionStorage, id, edited ? current : null)
        }}
      />
    </BoardStorageProvider>
  )
}

/**
 * `/keep/$id`: imports the visitor's edited board stashed by Keep, else the
 * snapshot, as a new fridge for the player, and redirects to '/' (ADR 0010,
 * amended). The import runs once: the ref guards StrictMode's double-invoke.
 */
export function KeepSharedBoardRoute() {
  const { id } = keepRoute.useParams()
  const storage = useBoardStorage()
  const navigate = useNavigate()
  const query = useQuery(sharedBoardQueryOptions(id))
  const imported = useRef(false)

  useEffect(() => {
    if (imported.current) return
    const board = takeKeep(window.sessionStorage, id) ?? (query.isSuccess ? query.data : null)
    if (board === null) return
    imported.current = true
    importSharedBoard(storage, board)
    void navigate({ to: '/', replace: true })
  }, [id, query.isSuccess, query.data, storage, navigate])

  if (query.isError) return <SharedNotFound />
  return <SharedLoading label="Keeping shared fridge…" />
}

function SharedLoading({ label }: { label: string }) {
  return (
    <div className={styles.state} data-testid="shared-loading">
      {label}
    </div>
  )
}

function SharedNotFound() {
  return (
    <div className={styles.state} data-testid="shared-not-found">
      <h1 className={styles.title}>This shared fridge doesn’t exist</h1>
      <p className={styles.body}>The link may be wrong, or the board was never shared.</p>
      {/* A plain link, not a router Link: the fridge is behind the gate, which only a page load meets. */}
      <a href="/" className={styles.home}>
        Go to the fridge
      </a>
    </div>
  )
}
