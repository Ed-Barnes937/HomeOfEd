import { Suspense } from 'react'

import { CloseUp } from '../shop/CloseUp.tsx'
import type { SceneProps } from '../shop/shopView.ts'
import { Tag } from '../shop/Tag.tsx'
import { useDisplay } from '../shop/useDisplay.ts'
import { STAGE_FILL, useStages } from '../stage/stage.ts'
import styles from './Anvil.module.scss'

/** The smithy's scene: the sword lying across the anvil, with its tag beside it. */
export function Anvil({ view, item, arrivals, reducedMotion, stageRef, onRename }: SceneProps) {
  const Stage = useStages(view.item.kind)?.Box
  const display = useDisplay({ stageRef, restsFlat: true })
  const { copy } = view
  const { params } = item
  const number = view.item.number(params)

  return (
    <div className={styles.scene}>
      <div
        className={styles.display}
        data-arrival={arrivals % 2}
        data-empty={display.empty || undefined}
        data-testid="counter"
      >
        <button
          type="button"
          className={styles.anvil}
          aria-label={copy.sceneButton}
          aria-haspopup="dialog"
          {...display.pointer}
        >
          <span className={styles.face} aria-hidden="true" />
          <span
            className={styles.shadow}
            style={{ width: `${view.item.lengthFraction(params) * STAGE_FILL * 130}%` }}
            aria-hidden="true"
          />
          <span ref={display.stageSlot} className={styles.stageSlot}>
            {Stage && (
              <Suspense fallback={null}>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </Suspense>
            )}
          </span>
        </button>

        <div className={styles.tagRow}>
          <Tag
            number={number}
            name={item.name ?? view.item.name(params)}
            description={view.item.tagLine(params)}
            nameLabel={copy.nameField}
            onRename={onRename}
          />
          <p className={styles.hint}>{copy.sceneHint}</p>
        </div>
      </div>
      {display.lifted && (
        <CloseUp view={view} item={item} reducedMotion={reducedMotion} {...display.closeUp} />
      )}
    </div>
  )
}
