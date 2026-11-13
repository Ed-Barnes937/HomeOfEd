import { useMemo, type CSSProperties } from 'react'

import { compilePotion } from '../potion/compile.ts'
import { BASE_LINE, SLOT_MM } from '../potion/framing.ts'
import { CloseUp } from '../shop/CloseUp.tsx'
import type { SceneProps } from '../shop/shopView.ts'
import { StageBoundary } from '../shop/StageBoundary.tsx'
import { Tag } from '../shop/Tag.tsx'
import { useDisplay } from '../shop/useDisplay.ts'
import { useStages } from '../stage/stage.ts'
import { BottleShadow, NeckTie } from './BottleFooting.tsx'
import styles from './BrewingTable.module.scss'
import { recipeCard } from './recipeCard.ts'
import { RoomWall } from './RoomWall.tsx'
import { bottleOnTable } from './tableArt.ts'

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')

/** The potion shop's scene: the bottle on the brewing table by the candle, its recipe card tied to its neck. */
export function BrewingTable({ view, item, reducedMotion, stageRef, onRename }: SceneProps) {
  const Stage = useStages(view.item.kind)?.Box
  const display = useDisplay({ stageRef })
  const { copy } = view
  const { params } = item
  const footing = useMemo(() => bottleOnTable(compilePotion(params)), [params])
  const card = recipeCard(view.item, item)

  const placing = {
    '--base-line': BASE_LINE,
    '--tie-h': footing.tie.heightMm / SLOT_MM,
    '--tie-w': footing.tie.halfWidthMm / SLOT_MM,
    '--glow-x': footing.glow.xMm / SLOT_MM,
    '--glow-y': footing.glow.yMm / SLOT_MM,
    '--glow-w': footing.glow.rxMm / SLOT_MM,
    '--glow-rgb': rgbOf(view.item.glow(params)),
  } as CSSProperties

  return (
    <div className={styles.scene} style={placing}>
      <RoomWall />
      <div className={styles.display} data-empty={display.empty || undefined} data-testid="counter">
        <button
          type="button"
          className={styles.bottle}
          aria-label={copy.sceneButton}
          aria-haspopup="dialog"
          {...display.pointer}
        >
          <BottleShadow footing={footing} className={styles.shadow} />
          <span className={styles.glow} aria-hidden="true" />
          <span ref={display.stageSlot} className={styles.stageSlot}>
            {Stage && (
              <StageBoundary>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </StageBoundary>
            )}
          </span>
          <NeckTie footing={footing} className={styles.tie} />
        </button>

        <div className={styles.card} data-gold={card.gold || undefined}>
          <div className={styles.tagBox}>
            <svg
              className={styles.twine}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className={styles.twineShade} d="M 0 100 C 30 92, 78 52, 100 0" />
              <path className={styles.twineStrand} d="M 0 100 C 30 92, 78 52, 100 0" />
              <path className={styles.twineTwist} d="M 0 100 C 30 92, 78 52, 100 0" />
            </svg>
            <div className={styles.paper}>
              <Tag
                number={card.number}
                name={card.name}
                description={card.description}
                nameLabel={copy.nameField}
                onRename={onRename}
              />
            </div>
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
