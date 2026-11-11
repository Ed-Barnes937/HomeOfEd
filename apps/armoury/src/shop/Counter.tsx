import type { CSSProperties } from 'react'

import { STAGE_FILL, useStages } from '../stage/stage.ts'
import { CloseUp } from './CloseUp.tsx'
import styles from './Counter.module.scss'
import { ShelfWall } from './ShelfWall.tsx'
import type { SceneProps } from './shopView.ts'
import { StageBoundary } from './StageBoundary.tsx'
import { Tag } from './Tag.tsx'
import { useDisplay } from './useDisplay.ts'

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function Counter({ view, item, arrivals, reducedMotion, stageRef, onRename }: SceneProps) {
  const Stage = useStages(view.item.kind)?.Box
  const display = useDisplay({ stageRef })
  const { copy } = view

  const { params } = item
  const coreRgb = hexToRgb(view.item.glow(params))
  const number = view.item.number(params)
  const lengthFraction = view.item.lengthFraction(params)
  // How far right of the box's centre the tip lies, as a fraction of the box's width.
  const tipOffset = lengthFraction * STAGE_FILL * 0.65

  return (
    <div
      className={styles.scene}
      style={{ '--core-rgb': coreRgb, '--tip': tipOffset } as CSSProperties}
    >
      <div className={styles.wall}>
        <ShelfWall />
        <div className={styles.wallShade} />
      </div>
      <div className={styles.beam} aria-hidden="true" />
      <div className={styles.counterTop} aria-hidden="true" />
      <div className={styles.spill} aria-hidden="true" />

      <div
        className={styles.display}
        data-arrival={arrivals % 2}
        data-empty={display.empty || undefined}
        data-testid="counter"
      >
        <div className={styles.lid} aria-hidden="true">
          <span className={styles.lidLabel}>No. {number}</span>
        </div>
        <button
          type="button"
          className={styles.box}
          aria-label={copy.sceneButton}
          aria-haspopup="dialog"
          {...display.pointer}
        >
          <span className={styles.velvet} aria-hidden="true" />
          <span
            className={styles.wandShadow}
            style={{
              width: `${lengthFraction * STAGE_FILL * 130}%`,
            }}
            aria-hidden="true"
          />
          <span ref={display.stageSlot} className={styles.stageSlot}>
            {Stage && (
              <StageBoundary>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </StageBoundary>
            )}
          </span>
        </button>

        <div className={styles.tagRow}>
          <svg className={styles.string} viewBox="0 0 100 120" aria-hidden="true">
            <path className={styles.stringWide} d="M 24 104 C 2 80, 22 30, 64 4" />
            <path className={styles.stringNarrow} d="M 31 90 C 14 70, 6 40, 15 10" />
          </svg>
          <Tag
            number={number}
            name={item.name ?? view.item.name(params)}
            description={view.item.tagLine(params)}
            nameLabel={copy.nameField}
            onRename={onRename}
          />
          <p className={styles.hint}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 2 v4 M10 14 v4 M2 10 h4 M14 10 h4 M4.5 4.5 l2.5 2.5 M13 13 l2.5 2.5 M15.5 4.5 l-2.5 2.5 M7 13 l-2.5 2.5" />
            </svg>
            {copy.sceneHint}
          </p>
        </div>
      </div>
      {display.lifted && (
        <CloseUp view={view} item={item} reducedMotion={reducedMotion} {...display.closeUp} />
      )}
    </div>
  )
}
