import { useEffect, useState } from 'react'

/**
 * The laptop breakpoint (boop-loops ticket 15). At and above 1280px the child
 * gets the clip-lanes design — clip header, clip control in the well, the
 * pinned song bar — and the old transport bar is gone. Below it the layouts
 * are handed over ticket by ticket: tablet (1024–1279, ticket 20) and phone
 * (`useIsPhone`, ticket 21) keep today's chrome until theirs land.
 *
 * Kept in sync with the `@media (min-width: 1280px)` / `(max-width: 1279px)`
 * blocks in the app's SCSS modules.
 */
export const LAPTOP_QUERY = '(min-width: 1280px)'

/** True when the viewport should use the clip-lanes laptop layout — see `LAPTOP_QUERY`. */
export function useIsLaptop(): boolean {
  const [laptop, setLaptop] = useState(() => globalThis.matchMedia?.(LAPTOP_QUERY).matches ?? false)

  useEffect(() => {
    const mq = window.matchMedia(LAPTOP_QUERY)
    const update = () => setLaptop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return laptop
}
