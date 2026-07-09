import { gearPalette, MAX_GEARS } from '../garden/engine/gears.ts'

import strip from './Strip.module.scss'
import styles from './CogDots.module.scss'

export interface CogDotsProps {
  wheels: number[]
  /** Add a cog — the page picks its teeth. Hidden once the train is at MAX_GEARS. */
  onAdd: () => void
  /** Remove the cog at `index`; the last cog can't be removed (min 1). */
  onRemove: (index: number) => void
}

/**
 * The gear train as inline dots — the one tactile item in the strip (ADR 0021).
 * One palette-coloured dot per cog (click to remove), plus a `+` to add. Each
 * cog is a pen, so N dots ⇒ N grooves; the count reads straight off the dots.
 */
export function CogDots({ wheels, onAdd, onRemove }: CogDotsProps) {
  const atMax = wheels.length >= MAX_GEARS
  const canRemove = wheels.length > 1

  return (
    <div className={styles.wrap}>
      <span className={strip.k}>Cogs</span>
      <span className={styles.dots}>
        {wheels.map((teeth, i) => {
          const [light, dark] = gearPalette(teeth)
          return (
            <button
              key={`${teeth}-${i}`}
              type="button"
              className={styles.dot}
              data-testid={`cog-dot-${i}`}
              disabled={!canRemove}
              aria-label={canRemove ? `Remove ${teeth}-tooth cog` : `${teeth}-tooth cog`}
              style={{ background: `radial-gradient(circle at 35% 30%, ${light}, ${dark})` }}
              onClick={() => canRemove && onRemove(i)}
            />
          )
        })}
        {!atMax && (
          <button
            type="button"
            className={styles.add}
            data-testid="cog-add"
            aria-label="Add a cog"
            onClick={onAdd}
          >
            +
          </button>
        )}
      </span>
    </div>
  )
}
