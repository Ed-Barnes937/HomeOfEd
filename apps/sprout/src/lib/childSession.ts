// The child's client-side session (localStorage). Ported from the source
// `lib/child-session.ts`. In prod the signed child-session TOKEN (minted by the
// childAuth procedures) travels in an httpOnly cookie the server sets — that
// transport is P5. This localStorage record is the UI-facing profile (name,
// preset, childId) the child screens read; it is NOT the auth credential.
import type { PresetName } from '../server/domain/presets.ts'

const CHILD_SESSION_KEY = 'sprout-child-session'

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
}
