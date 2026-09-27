// Post-login redirect target for /parent/login (ADR 0068): only same-origin
// parent screens, so a crafted link can't bounce a parent off-site.
/** The child-settings screen with the reset confirm open (`?reset=1`). */
export const childResetPath = (childId: string): string => `/parent/children/${childId}?reset=1`

const BASE = 'https://sprout.invalid'

export function safeParentRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\\')) return undefined
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return undefined
  }
  if (url.origin !== BASE) return undefined
  if (!url.pathname.startsWith('/parent/') || url.pathname === '/parent/login') return undefined
  return `${url.pathname}${url.search}${url.hash}`
}
