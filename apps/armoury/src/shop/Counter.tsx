import { Suspense, use, useRef, useState, type CSSProperties, type RefObject } from 'react'

import type { StoredItem } from '../items/item.ts'
import { LONGEST_WAND_MM, STAGE_FILL, StageContext, type StageHandle } from '../stage/stage.ts'
import { wandDescription, wandName, wandNumber } from '../wand/describe.ts'
import { swatchFor } from '../wand/wandSchema.ts'
import { CloseUp } from './CloseUp.tsx'
import styles from './Counter.module.scss'
import { ShelfWall } from './ShelfWall.tsx'
import { Tag } from './Tag.tsx'

const DRAG_SLOP_PX = 6
/** A drag across the whole box turns the wand this far. */
const TURNS_PER_BOX = 0.8

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function Counter({
  wand,
  arrivals,
  reducedMotion,
  stageRef,
  onRename,
}: {
  wand: StoredItem
  arrivals: number
  reducedMotion: boolean
  stageRef: RefObject<StageHandle | null>
  onRename: (name: string) => void
}) {
  const Stage = use(StageContext)?.Box
  const [lifted, setLifted] = useState(false)
  const [boxEmpty, setBoxEmpty] = useState(false)
  const drag = useRef<{ x: number; travelled: number } | null>(null)
  const moved = useRef(false)
  const turns = useRef(0)
  const stageSlot = useRef<HTMLSpanElement>(null)

  const { params } = wand
  const coreRgb = hexToRgb(swatchFor('core', params.core as string) ?? '#ffc95c')
  const number = wandNumber(params)
  const lengthFraction = ((params.lengthCm as number) * 10) / LONGEST_WAND_MM
  // How far right of the box's centre the tip lies, as a fraction of the box's width.
  const tipOffset = lengthFraction * STAGE_FILL * 0.65

  const boxPose = () => ({
    rect: stageSlot.current?.getBoundingClientRect() ?? new DOMRect(),
    turns: turns.current,
  })

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
        data-empty={boxEmpty || undefined}
        data-testid="counter"
      >
        <div className={styles.lid} aria-hidden="true">
          <span className={styles.lidLabel}>No. {number}</span>
        </div>
        <button
          type="button"
          className={styles.box}
          aria-label="Give the wand a wave"
          aria-haspopup="dialog"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, travelled: 0 }
            moved.current = false
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            const dx = e.clientX - drag.current.x
            drag.current = { x: e.clientX, travelled: drag.current.travelled + Math.abs(dx) }
            if (drag.current.travelled > DRAG_SLOP_PX) moved.current = true
            if (moved.current) {
              const rolled = (dx / e.currentTarget.clientWidth) * TURNS_PER_BOX
              turns.current += rolled
              stageRef.current?.roll(rolled)
            }
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onClick={() => {
            if (!moved.current) setLifted(true)
            moved.current = false
          }}
        >
          <span className={styles.velvet} aria-hidden="true" />
          <span
            className={styles.wandShadow}
            style={{
              width: `${(((params.lengthCm as number) * 10) / LONGEST_WAND_MM) * STAGE_FILL * 130}%`,
            }}
            aria-hidden="true"
          />
          <span ref={stageSlot} className={styles.stageSlot}>
            {Stage && (
              <Suspense fallback={null}>
                <Stage ref={stageRef} params={params} reducedMotion={reducedMotion} />
              </Suspense>
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
            name={wand.name ?? wandName(params)}
            description={wandDescription(params)}
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
            Tap the wand to give it a wave
          </p>
        </div>
      </div>
      {lifted && (
        <CloseUp
          wand={wand}
          reducedMotion={reducedMotion}
          boxPose={boxPose}
          onLift={() => setBoxEmpty(true)}
          onClosed={() => {
            setLifted(false)
            setBoxEmpty(false)
          }}
        />
      )}
    </div>
  )
}
