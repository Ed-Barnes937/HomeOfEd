import { useEffect, useState } from 'react'

/** Kept in sync with the `@media (max-width: 899px)` blocks in the SCSS modules. */
export const PHONE_QUERY = '(max-width: 899px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** A touch screen, with no pointer that can hover; kept in sync with `(hover: none)` in the SCSS. */
export const TOUCH_QUERY = '(hover: none)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => globalThis.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

export function hubUrl(hostname: string): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000'
  return 'https://homeofed.com'
}
