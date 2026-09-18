import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { hasPitch } from '../../engine/pitch.ts'
import { PITCHES_PER_LANE, STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'
import { pitchIndexAtOffset } from './laneGeometry.ts'
import styles from './PitchedLane.module.scss'
import { laneCellLabel } from './solfege.ts'
import type { DragPaintHandlers } from './useDragPaint.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE
/** Drawn top down, so the highest pitch is the highest tile. */
const PITCHES = Array.from({ length: PITCHES_PER_LANE }, (_, i) => PITCHES_PER_LANE - 1 - i)

interface PitchedLaneProps {
  instrumentId: string
  instrumentName: string
  /** The row's notes, one bitmask per step — already read through the anchor rule. */
  masks: readonly number[]
  playheadStep: number | null
  paint: DragPaintHandlers
  onCellKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    step: number,
    pitchIndex: number,
    isOn: boolean,
  ) => void
}

/**
 * A pitched row's 16 step columns: eight stacked cells each, where height is
 * pitch (pitched-lane spec §1). It replaces `Grid`'s `.steps` on a row whose
 * instrument the manifest flags `pitched`, on the same step columns the drum
 * rows use (spec §2).
 */
export function PitchedLane({
  instrumentId,
  instrumentName,
  masks,
  playheadStep,
  paint,
  onCellKeyDown,
}: PitchedLaneProps) {
  return (
    <div
      className={styles.lane}
      role="group"
      aria-label={`${instrumentName} lane`}
      data-testid={`lane-${instrumentId}`}
    >
      {Array.from({ length: GROUP_COUNT }, (_, group) => (
        <div key={group} className={styles.group}>
          {Array.from({ length: GROUP_SIZE }, (_, i) => {
            const step = group * GROUP_SIZE + i
            const mask = masks[step] ?? 0
            const onAt = (pitchIndex: number) => hasPitch(mask, pitchIndex)
            const underPlayhead = step === playheadStep
            return (
              <div
                key={step}
                className={styles.column}
                data-testid={`lane-column-${instrumentId}-${step}`}
                onPointerDown={(event) => {
                  const pitchIndex = pitchAtPointer(event)
                  if (pitchIndex === null) return
                  paint.onPointerDown(event, instrumentId, step, onAt(pitchIndex), pitchIndex)
                }}
                onPointerMove={(event) => {
                  const pitchIndex = pitchAtPointer(event)
                  if (pitchIndex === null) return
                  paint.onPointerEnter(event, instrumentId, step, onAt(pitchIndex), pitchIndex)
                }}
              >
                {PITCHES.map((pitchIndex) => {
                  const on = onAt(pitchIndex)
                  return (
                    <button
                      key={pitchIndex}
                      type="button"
                      className={styles.cell}
                      data-pitch={pitchIndex}
                      data-active={on}
                      data-playhead={underPlayhead}
                      data-testid={`lane-cell-${instrumentId}-${step}-${pitchIndex}`}
                      aria-pressed={on}
                      aria-label={laneCellLabel(pitchIndex, step, on)}
                      onClick={(event) => paint.onClick(event, instrumentId, step, pitchIndex)}
                      onKeyDown={(event) => onCellKeyDown(event, step, pitchIndex, on)}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Which of the column's eight hit bands the pointer is in. The lane is measured
 * rather than assumed, so the bands cannot drift from the tiles the stylesheet
 * actually drew (`laneGeometry.ts`).
 */
function pitchAtPointer(event: ReactPointerEvent<HTMLDivElement>): number | null {
  const column = event.currentTarget.getBoundingClientRect()
  const cells = event.currentTarget.children
  const first = cells[0]?.getBoundingClientRect()
  const second = cells[1]?.getBoundingClientRect()
  if (!first || !second) return null
  return pitchIndexAtOffset(event.clientY - column.top, {
    platePadding: first.top - column.top,
    cellHeight: first.height,
    gap: second.top - first.bottom,
  })
}

/** A pitched row's rail: its name over the HIGH / gradient / LOW pitch key, the only pitch legend there is. */
export function PitchLegend({ children }: { children: ReactNode }) {
  return (
    <span className={styles.legend}>
      {children}
      <span className={styles.legendEdge}>HIGH</span>
      <span className={styles.legendBar} aria-hidden="true" />
      <span className={styles.legendEdge}>LOW</span>
    </span>
  )
}
