// The child's client-side session (localStorage). Ported from the source
// `lib/child-session.ts`. In prod the signed child-session TOKEN (minted by the
// childAuth procedures) travels in an httpOnly cookie the server sets — that
// transport is P5. This localStorage record is the UI-facing profile (name,
// preset, childId) the child screens read; it is NOT the auth credential.
import type { PresetName } from '@hoe/sprout-shared'

const CHILD_SESSION_KEY = 'sprout-child-session'

// Name of the cookie carrying the SIGNED child-session token (mirrors
// CHILD_SESSION_COOKIE in server/auth/providers.ts — duplicated here rather than
// imported because that module transitively pulls in node:crypto, which must
// not enter the browser bundle). The token is minted + HMAC-signed server-side
// at login; the SPA sets it as a same-origin cookie so the SSE route and the
// child-scoped tRPC calls authenticate. Not httpOnly (an SPA can't set that,
// and the tRPC context seam can't reach the response) — but tampering is
// detected by the server-side signature check (auth/childToken.ts), which is
// the property #34 required.
const CHILD_SESSION_COOKIE = 'sprout_child_session'
const CHILD_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60

export interface ChildSession {
  id: string
  displayName: string
  username: string
  presetName: PresetName
  parentId: string
}

export function getChildSession(): ChildSession | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(CHILD_SESSION_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as ChildSession
  } catch {
    return null
  }
}

export function setChildSession(session: ChildSession): void {
  localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session))
}

export function clearChildSession(): void {
  localStorage.removeItem(CHILD_SESSION_KEY)
  clearChildSessionCookie()
}

/** Set the signed child-session cookie from the token minted at login. The
 * server's child AuthProvider reads + verifies it on the SSE + child-scoped
 * tRPC paths. */
export function setChildSessionCookie(token: string): void {
  if (typeof document === 'undefined') return
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${CHILD_SESSION_COOKIE}=${token}; path=/; max-age=${CHILD_COOKIE_MAX_AGE_S}; samesite=lax${secure}`
}

export function clearChildSessionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${CHILD_SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}
