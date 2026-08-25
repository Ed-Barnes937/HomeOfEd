// PROTOTYPE — throwaway. See ./README.md. Delete this folder once a variant wins.
import { useEffect, useState } from 'react'

import { VARIANTS, VARIANT_NAMES, type Variant } from './usePrototypeVariant.ts'
import styles from './PrototypeSwitcher.module.scss'

interface PrototypeSwitcherProps {
  variant: Variant
  onSelect: (next: Variant) => void
}

/**
 * Live measurement of the two boxes the whole question is about: the grid's
 * own scroller and the visible song surface. Prototype rule 5 — surface the
 * state, so a variant switch shows what it actually bought the grid.
 */
function useMeasurements() {
  const [text, setText] = useState('')
  useEffect(() => {
    const tick = () => {
      const grid = document.querySelector('[data-testid="grid-scroll"]')
      const song =
        document.querySelector('[data-testid="phone-song-bar"]') ??
        document.querySelector('[data-testid="song-bar"]')
      const g = grid ? Math.round(grid.getBoundingClientRect().height) : 0
      const s = song ? Math.round(song.getBoundingClientRect().height) : 0
      setText(
        `grid ${g}px · song ${s === 0 ? 'hidden' : `${s}px`} · ${window.innerWidth}×${window.innerHeight}`,
      )
    }
    tick()
    const id = window.setInterval(tick, 400)
    window.addEventListener('resize', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', tick)
    }
  }, [])
  return text
}

/** The floating variant bar. Never rendered in a production build. */
export function PrototypeSwitcher({ variant, onSelect }: PrototypeSwitcherProps) {
  const measurements = useMeasurements()
  const index = VARIANTS.indexOf(variant)

  const step = (delta: number) =>
    onSelect(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]!)

  useEffect(() => {
    // **Alt** + arrows, not bare arrows. The grid, the loop map and both scrub
    // strips all own the arrow keys for real behaviour (spec §14), so a bare
    // global binding silently steals them — three `.iwft` suites caught it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return
      if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (import.meta.env.PROD) return null

  return (
    <div className={styles.bar} data-testid="prototype-switcher">
      <button type="button" className={styles.arrow} onClick={() => step(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span className={styles.label}>
        <strong>
          {String.fromCharCode(65 + index)} — {VARIANT_NAMES[variant]}
        </strong>
        <span className={styles.measure}>{measurements}</span>
      </span>
      <button type="button" className={styles.arrow} onClick={() => step(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  )
}
