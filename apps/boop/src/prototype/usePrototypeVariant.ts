// PROTOTYPE — throwaway. See ./README.md. Delete this folder once a variant wins.
import { useCallback, useEffect, useState } from 'react'

/** The variant keys, in switcher order. `now` is the shipped layout, the control. */
export const VARIANTS = ['now', 'song-dialog', 'clip-dialog', 'tabs'] as const

export type Variant = (typeof VARIANTS)[number]

export const VARIANT_NAMES: Record<Variant, string> = {
  now: 'Shipped layout (control)',
  'song-dialog': 'Grid on the frame, song in a dialog',
  'clip-dialog': 'Song on the frame, grid in a dialog',
  tabs: 'Clip / Song tabs',
}

function read(): Variant {
  const raw = new URLSearchParams(window.location.search).get('variant')
  return (VARIANTS as readonly string[]).includes(raw ?? '') ? (raw as Variant) : 'now'
}

/**
 * The `?variant=` param as state. Deliberately not TanStack Router search
 * params: this is throwaway, and adding `validateSearch` to the real index
 * route would be a production change the prototype does not need.
 */
export function usePrototypeVariant(): [Variant, (next: Variant) => void] {
  const [variant, setVariant] = useState<Variant>(read)

  const select = useCallback((next: Variant) => {
    const url = new URL(window.location.href)
    if (next === 'now') url.searchParams.delete('variant')
    else url.searchParams.set('variant', next)
    window.history.replaceState(null, '', url)
    setVariant(next)
  }, [])

  useEffect(() => {
    const onPop = () => setVariant(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return [variant, select]
}
