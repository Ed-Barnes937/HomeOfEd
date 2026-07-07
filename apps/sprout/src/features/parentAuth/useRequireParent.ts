// Shared parent-gate: every parent screen calls this to redirect to
// /parent/login when the session probe (parentSessionQueryOptions) rejects.
// Returns the query state so pages can render a "Loading..." placeholder while
// it settles (mirrors the source's `useParentSession` gate).
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { parentSessionQueryOptions } from './parentAuth.ts'

export function useRequireParent() {
  const navigate = useNavigate()
  const query = useQuery(parentSessionQueryOptions)

  useEffect(() => {
    if (!query.isPending && !query.data) {
      void navigate({ to: '/parent/login' })
    }
  }, [query.isPending, query.data, navigate])

  return query
}
