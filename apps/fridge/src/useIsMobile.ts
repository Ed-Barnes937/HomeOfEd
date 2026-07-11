import { useEffect, useState } from 'react'

/**
 * The mobile-chrome rule (ADR 0023). Compact chrome is used for **any touch
 * device** (`pointer: coarse` — phones and tablets regardless of width) **or**
 * any viewport narrow enough that the desktop chrome would overflow
 * (`max-width: 1023px`). The desktop chrome therefore renders only on a
 * fine-pointer viewport ≥1024px — where it is pixel-identical to before. Kept
 * in sync with the `@media` query in `FridgePage.module.scss`.
 */
export const MOBILE_QUERY = '(pointer: coarse), (max-width: 1023px)'

/**
 * True when the viewport should use the compact chrome (touch device or narrow
 * viewport — see `MOBILE_QUERY`). Read synchronously on first render (no layout
 * flash) and kept live via a matchMedia listener. Drives which chrome renders —
 * desktop stays pixel-identical because its branch is unchanged and the mobile
 * branch is simply not mounted above the breakpoint.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => globalThis.matchMedia?.(MOBILE_QUERY).matches ?? false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return mobile
}
