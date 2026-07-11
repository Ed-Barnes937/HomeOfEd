import { useEffect, useState } from 'react'

/** The mobile-chrome breakpoint (ADR 0023). Above it, the layout is untouched. */
export const MOBILE_QUERY = '(max-width: 640px)'

/**
 * True when the viewport is at or below the mobile breakpoint. Read
 * synchronously on first render (no layout flash) and kept live via a
 * matchMedia listener. Drives which chrome renders — desktop stays
 * pixel-identical because its branch is unchanged and the mobile branch is
 * simply not mounted above the breakpoint.
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
