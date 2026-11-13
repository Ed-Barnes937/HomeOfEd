import type { CSSProperties } from 'react'

import { BASE_LINE } from '../potion/framing.ts'
import { CloseUp } from '../shop/CloseUp.tsx'
import type { SceneProps } from '../shop/shopView.ts'
import { StageBoundary } from '../shop/StageBoundary.tsx'
import { Tag } from '../shop/Tag.tsx'
import { useDisplay } from '../shop/useDisplay.ts'
import { useStages } from '../stage/stage.ts'
import styles from './BrewingTable.module.scss'

/** The potion shop's scene: the bottle standing on the table, its recipe card in front. */
export function BrewingTable({ view, item, reducedMotion, stageRef, onRename }: SceneProps) {
  const Stage = useStages(view.item.kind)?.Box
  const display = useDisplay({ stageRef })
  const { copy } = view
  const { params } = item

  return (
    <div className={styles.scene} style={{ '--base-line': BASE_LINE } as CSSProperties}>
      <div className={styles.display} data-empty={display.empty || undefined} data-testid="counter">
        <button
          type="button"
          className={styles.bottle}
          aria-label={copy.sceneButton}
          aria-haspopup="dialog"
          {...display.pointer}
        >
          <span ref={display.stageSlot} className={styles.stageSlot}>
            {Stage && (
              <StageBoundary>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </StageBoundary>
            )}
          </span>
        </button>
        <div className={styles.table} aria-hidden="true" />

        <div className={styles.cardRow}>
          <Tag
            number={view.item.number(params)}
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
