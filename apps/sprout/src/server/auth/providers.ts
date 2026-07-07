// The two AuthProvider implementations behind the one `ctx.auth` seam
// (plan §5.2). `User = { id: string }` from backend-kit is extended by
// intersection to carry the sprout role and, for children, the owning parent.
//
//   parent  → Better Auth cookie session  → { id, role: 'parent' }
//   child   → signed child-session token   → { id, role: 'child', parentId }
//
// Which provider a router uses is chosen per-router in P3. The child provider
// is fully synchronous and drops straight into `createContext`'s
// `auth?: (req) => AuthProvider` seam; the parent provider needs Better Auth's
// async session lookup, so it is resolved via `resolveParentUser` and wrapped
// into a provider with `fixedAuthProvider` (see auth/README notes in the
// migration plan — the async resolve happens in the P5/D9 Fastify hook).
import type { AuthProvider, User } from '@hoe/backend-kit'

import { verifyChildToken } from './childToken.ts'

export type ParentUser = User & { role: 'parent' }
export type ChildUser = User & { role: 'child'; parentId: string }
export type SproutUser = ParentUser | ChildUser

/** Cookie the signed child-session token travels in (browser ↔ server). */
export const CHILD_SESSION_COOKIE = 'sprout_child_session'

/**
 * The slice of a Better Auth instance the parent provider depends on. Kept as a
 * structural interface so this module needs no `better-auth` import — the real
 * instance (with its richer user shape) is assignable.
 */
export interface SessionResolver {
  api: {
    getSession(opts: { headers: Headers }): Promise<{ user: { id: string } } | null>
  }
}

/** Extract the raw child-session token from the request Cookie header. */
export function readChildToken(req: Request): string | null {
  const cookie = req.headers.get('cookie')
  if (!cookie) return null
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name === CHILD_SESSION_COOKIE) return part.slice(eq + 1).trim()
  }
  return null
}

/** Wrap an already-resolved user (or none) into an AuthProvider. */
export function fixedAuthProvider(user: SproutUser | null): AuthProvider {
  return { getUser: () => user }
}

/**
 * The child provider: synchronous, fits the `createContext.auth` seam directly.
 * Reads the signed token from the cookie and verifies its HMAC; a missing /
 * tampered / expired token resolves to no user (anonymous), never an error.
 */
export function childAuthProvider(
  secret: string,
  now: () => Date = () => new Date(),
): (req: Request) => AuthProvider {
  return (req) => {
    const token = readChildToken(req)
    const claims = token ? verifyChildToken(token, secret, now) : null
    const user: ChildUser | null = claims
      ? { id: claims.childId, role: 'child', parentId: claims.parentId }
      : null
    return { getUser: () => user }
  }
}

/**
 * The parent provider's async half: resolve the Better Auth cookie session from
 * the request server-side and map it to a parent user. Returns `null` when
 * there is no valid session.
 */
export async function resolveParentUser(
  auth: SessionResolver,
  req: Request,
): Promise<ParentUser | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) return null
  return { id: session.user.id, role: 'parent' }
}
