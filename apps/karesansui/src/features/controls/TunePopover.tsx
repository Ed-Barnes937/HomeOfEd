import { useEffect, useRef, useState } from 'react'

import { Slider } from './Slider.tsx'
import styles from './TunePopover.module.scss'

/** Speed reads as a mood, not a number — matches the reference `speedLabel`. */
function speedLabel(speed: number): string {
  if (speed < 33) return 'slow'
  if (speed < 67) return 'steady'
  return 'brisk'
}

export interface TunePopoverProps {
  /** Pin offset, 0..1. */
  offset: number
  /** Speed, 0..100. */
  speed: number
  /** Current rotations (already clamped to `fullTurns`). */
  turns: number
  /** Maximum rotations for the current ring + train. */
  fullTurns: number
  /** Receives the raw slider value 0..100 (the page clamps to 0.08..0.94). */
  onOffset: (raw: number) => void
  onSpeed: (value: number) => void
  onRotations: (value: number) => void
}

/**
 * The `tune ▾` disclosure: keeps the low-frequency dials (offset / speed /
 * rotations) one reach away without cluttering the resting console. A proper
 * disclosure — `aria-expanded`/`aria-controls`, Escape and outside-click close,
 * focus returns to the button on close. Not a focus trap.
 */
export function TunePopover({
  offset,
  speed,
  turns,
  fullTurns,
  onOffset,
  onSpeed,
  onRotations,
}: TunePopoverProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = (returnFocus: boolean): void => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector('input')?.focus()
  }, [open])

  // Escape closes (focus back to the button); a click outside closes silently.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(true)
    }
    const onDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className={styles.button}
        data-testid="tune-button"
        aria-expanded={open}
        aria-controls="tune-panel"
        aria-haspopup="dialog"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        Tune <span aria-hidden="true" className={styles.caret} data-open={open}>▾</span>
      </button>

      {open && (
        <div
          className={styles.panel}
          id="tune-panel"
          role="dialog"
          aria-label="Fine tuning"
          data-testid="tune-panel"
          ref={panelRef}
        >
          <Slider
            label="Pin offset"
            testId="slider-offset"
            valueText={`${offset.toFixed(2)} r`}
            min={8}
            max={94}
            value={Math.round(offset * 100)}
            onChange={onOffset}
          />
          <Slider
            label="Speed"
            testId="slider-speed"
            valueText={speedLabel(speed)}
            min={0}
            max={100}
            value={speed}
            onChange={onSpeed}
          />
          <Slider
            label="Rotations"
            testId="slider-rotations"
            valueText={`${turns} of ${fullTurns}`}
            min={1}
            max={fullTurns}
            value={turns}
            onChange={onRotations}
          />
        </div>
      )}
    </div>
  )
}
