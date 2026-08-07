import { useEffect, useState } from 'react'

/**
 * The small-phone breakpoint (ticket 27). The tablet layout needs
 * `rail + railGap + 16 x cellW + 12 x gap + 3 x gutter` = 924px plus 52px of
 * frame padding, so 1024px is the narrowest viewport it fits — below that the
 * grid would have to shrink, and the grid is never allowed to shrink below
 * 6 x 16. Everything narrower gets the pinned-rail scroll window instead.
 *
 * Width only, deliberately: unlike the fridge (ADR 0023) boop's tablet layout
 * is the *primary* target and is entirely touch-friendly, so a coarse pointer
 * at 1024px+ should keep it.
 *
 * Kept in sync with the `@media (max-width: 1023px)` blocks in the app's SCSS
 * modules.
 */
export const PHONE_QUERY = '(max-width: 1023px)'

/** True when the viewport should use the small-phone layout — see `PHONE_QUERY`. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => globalThis.matchMedia?.(PHONE_QUERY).matches ?? false)

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return phone
}
