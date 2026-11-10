import type { AuthProvider, User } from '@hoe/backend-kit'

/**
 * The parent behind a verified Better Auth cookie session. `kind` is what
 * separates it from a family-token user: that token is readable by client JS on
 * every estate subdomain and must never authorise an identity procedure.
 */
export type ParentUser = User & { kind: 'parent-session' }

export function isParentSession(user: User): user is ParentUser {
  return (user as Partial<ParentUser>).kind === 'parent-session'
}

export function parentSessionProvider(parentId: string): AuthProvider {
  const parent: ParentUser = { id: parentId, kind: 'parent-session' }
  return { getUser: () => parent }
}

/** The slice of Better Auth this bridge needs, so the module imports none of it. */
export interface SessionResolver {
  api: {
    getSession(opts: { headers: Headers }): Promise<{ user: { id: string } } | null>
  }
}

export async function resolveParentId(
  auth: SessionResolver,
  headers: Headers,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers })
  return session?.user.id ?? null
}
