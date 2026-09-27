// Shared parent-gate: every parent screen calls this to redirect to
// /parent/login (with the current screen as `redirect`) when the session probe
// (parentSessionQueryOptions) rejects. Returns the query state so pages can
// render a "Loading..." placeholder while it settles.
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { safeParentRedirect } from '../../lib/parentRedirect.ts'
import { parentSessionQueryOptions } from './parentAuth.ts'

export function useRequireParent() {
  const navigate = useNavigate()
  const router = useRouter()
  const query = useQuery(parentSessionQueryOptions)

  useEffect(() => {
    if (!query.isPending && !query.data) {
      // Read at bounce time, not subscribed: once the URL is /parent/login a
      // re-run would overwrite the redirect with the login page itself.
      const redirect = safeParentRedirect(router.state.location.href)
      void navigate({ to: '/parent/login', search: { redirect } })
    }
  }, [query.isPending, query.data, navigate, router])

  return query
}
