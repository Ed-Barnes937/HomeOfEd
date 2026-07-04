import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { sharedBoardQueryOptions } from './boardApi.ts'
import { importSharedBoard } from './importSharedBoard.ts'
import styles from './SharedBoardRoute.module.scss'

const route = getRouteApi('/b/$id')

/**
 * The `/b/$id` route: fetches the shared snapshot, imports it as a new local
 * fridge, and redirects to '/' (ADR 0010: import-on-open). An unknown id
 * (NOT_FOUND, or a malformed id the server rejects) shows a small dead-link
 * state instead. The import runs once — the effect guards against StrictMode's
 * double-invoke and the redirect.
 */
export function SharedBoardRoute() {
  const { id } = route.useParams()
  const navigate = useNavigate()
  const query = useQuery(sharedBoardQueryOptions(id))
  const imported = useRef(false)

  useEffect(() => {
    if (!query.isSuccess || imported.current) return
    imported.current = true
    importSharedBoard(window.localStorage, query.data)
    void navigate({ to: '/', replace: true })
  }, [query.isSuccess, query.data, navigate])

  if (query.isError) {
    return (
      <div className={styles.state} data-testid="shared-not-found">
        <h1 className={styles.title}>This shared fridge doesn’t exist</h1>
        <p className={styles.body}>The link may be wrong, or the board was never shared.</p>
        <Link to="/" className={styles.home}>
          Go to the fridge
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.state} data-testid="shared-loading">
      Opening shared fridge…
    </div>
  )
}
