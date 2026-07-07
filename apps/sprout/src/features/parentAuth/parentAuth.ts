// Parent auth for the SPA (plan §5.3). Login/register/sign-out call Better
// Auth's REST endpoints under `/api/auth/*` with the cookie session (replaces
// the source `api/parent-auth.ts`).
//
// P4/P5 SEAM: the prod `/api/auth/*` Fastify mount is deferred to P5/D9, so the
// sign-up/sign-in/sign-out round-trips below cannot be exercised end-to-end in
// dev/prod or in the `.iwft` harness yet (the harness only trampolines
// `/api/trpc`). They are wired correctly for when the mount lands.
//
// The parent-session GATE, by contrast, must work in `.iwft` (parent screens
// redirect to /parent/login when unauthenticated). Identity is server-side via
// `ctx.auth`, so the gate PROBES a parent-scoped tRPC call (`children.list`)
// which the harness trampolines and authenticates via the test-user header.
// TODO(P5): replace the probe with a dedicated session/`me` procedure that can
// also return the parent's display name (the dashboard currently omits it).
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

interface AuthError {
  message: string
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string }
  return body.message ?? fallback
}

export const parentAuth = {
  signUp: async (data: {
    name: string
    email: string
    password: string
  }): Promise<{ error: AuthError | null }> => {
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) return { error: { message: await readErrorMessage(res, 'Sign up failed') } }
    return { error: null }
  },

  signIn: async (data: {
    email: string
    password: string
  }): Promise<{ error: AuthError | null }> => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) {
      return { error: { message: await readErrorMessage(res, 'Invalid email or password.') } }
    }
    return { error: null }
  },

  signOut: async (): Promise<void> => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
  },
}

export interface ParentSession {
  authenticated: true
}

/**
 * The parent-session gate. Resolves to a session when a parent-scoped tRPC call
 * succeeds; rejects (→ redirect to login) when unauthenticated. `retry: false`
 * so an UNAUTHORIZED surfaces immediately instead of being retried.
 */
export const parentSessionQueryOptions = queryOptions({
  queryKey: ['parent-session'],
  queryFn: async (): Promise<ParentSession> => {
    await trpcClient.children.list.query()
    return { authenticated: true }
  },
  retry: false,
  staleTime: 5 * 60 * 1000,
})
