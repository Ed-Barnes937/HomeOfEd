import { Suspense, useMemo, type CSSProperties } from 'react'

import { CloseUp } from '../shop/CloseUp.tsx'
import type { SceneProps } from '../shop/shopView.ts'
import { Tag } from '../shop/Tag.tsx'
import { useDisplay } from '../shop/useDisplay.ts'
import { useStages } from '../stage/stage.ts'
import { compileSword } from '../sword/compile.ts'
import styles from './Anvil.module.scss'
import { anvilImage, swordOnAnvil } from './anvilArt.ts'
import { ForgeFloor, ForgeWall } from './ForgeWall.tsx'
import { SwordShadow } from './SwordShadow.tsx'

/** The smithy's scene: the sword lying across the anvil by the forge, with its ticket beside it. */
export function Anvil({ view, item, arrivals, reducedMotion, stageRef, onRename }: SceneProps) {
  const Stage = useStages(view.item.kind)?.Box
  const display = useDisplay({ stageRef, restsFlat: true })
  const { copy } = view
  const { params } = item
  const number = view.item.number(params)
  const onAnvil = useMemo(() => swordOnAnvil(compileSword(params)), [params])

  return (
    <div className={styles.scene}>
      <ForgeWall />
      <ForgeFloor />
      <div className={styles.shaft} aria-hidden="true" />
      <div className={styles.spill} aria-hidden="true" />

      <div
        className={styles.display}
        style={{ '--grip': onAnvil.gripX, '--reach': onAnvil.reach } as CSSProperties}
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
          <span
            className={styles.anvilArt}
            style={{ backgroundImage: anvilImage() }}
            aria-hidden="true"
          />
          <SwordShadow blade={onAnvil.blade} hilt={onAnvil.hilt} className={styles.shadow} />
          <span ref={display.stageSlot} className={styles.stageSlot}>
            {Stage && (
              <Suspense fallback={null}>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </Suspense>
            )}
          </span>
        </button>

        <div className={styles.tagRow}>
          <div className={styles.ticket}>
            <svg
              className={styles.twine}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className={styles.twineShade} d="M 0 100 C 4 55, 50 22, 100 2" />
              <path className={styles.twineStrand} d="M 0 100 C 4 55, 50 22, 100 2" />
              <path className={styles.twineTwist} d="M 0 100 C 4 55, 50 22, 100 2" />
            </svg>
            <Tag
              number={number}
              name={item.name ?? view.item.name(params)}
              description={view.item.tagLine(params)}
              nameLabel={copy.nameField}
              onRename={onRename}
            />
          </div>
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
