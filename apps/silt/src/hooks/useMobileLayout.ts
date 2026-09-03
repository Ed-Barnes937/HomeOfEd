import { useEffect, useState } from 'react'

/**
 * The app's mobile rule, in JavaScript. It is the same query the stylesheets
 * carry (`$mobile` in `HomePage.module.scss` and friends, the house pattern
 * from ADR 0023): any touch device, or any viewport narrow enough that the
 * desktop layout would be unusable.
 *
 * **CSS is still the default answer.** This exists for the handful of choices a
 * media query cannot make - a *number* handed to a component, like the Field
 * notes tile that is 22px in the desktop picker column and 30px in the phone's
 * tile grid. Anything that can be a rule belongs in the stylesheet beside the
 * rest of the breakpoint.
 */
export const MOBILE_QUERY = '(pointer: coarse), (max-width: 700px)'

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => matches())

  useEffect(() => {
    const list = window.matchMedia?.(MOBILE_QUERY)
    if (!list) return
    const onChange = (): void => setMobile(list.matches)
    // Re-read on mount as well: a resize between the first render and this
    // effect would otherwise leave the layout a breakpoint behind.
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])

  return mobile
}

function matches(): boolean {
  return window.matchMedia?.(MOBILE_QUERY).matches ?? false
}
