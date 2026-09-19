import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import { hasPitch, pitchesInMask } from '../../engine/pitch.ts'
import { PITCHES_PER_LANE, STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'
import { pitchIndexAtOffset } from './laneGeometry.ts'
import { pebbleOffset, pitchContour } from './laneSummary.ts'
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
  /** The row's notes, one bitmask per step - already read through the anchor rule. */
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
      {stepGroups((step) => {
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
            onClick={(event) => {
              // Tiles take no pointer events (ADR 0060), so a pointer click
              // lands here; a keyboard one is only passing through.
              if (event.target !== event.currentTarget) return
              const pitchIndex = pitchAtPointer(event)
              if (pitchIndex === null) return
              paint.onClick(event, instrumentId, step, pitchIndex)
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
  )
}

/** The 16 steps in their four bar groups - the columns both lane views sit on. */
function stepGroups(renderStep: (step: number) => ReactNode): ReactNode {
  return Array.from({ length: GROUP_COUNT }, (_, group) => (
    <div key={group} className={styles.group}>
      {Array.from({ length: GROUP_SIZE }, (_, i) => renderStep(group * GROUP_SIZE + i))}
    </div>
  ))
}

/**
 * A collapsed pitched row (design handoff, "Collapse"): a pebble per painted
 * note, at that note's height, on the lane's own step columns. Read-only -
 * painting means expanding first - but a tap anywhere on it is that expansion
 * (ADR 0061, as amended). It stays out of the a11y tree; the chevron is the
 * labelled control for both, and `onClick` rather than `onPointerDown` is what
 * leaves a sideways pan to the step window.
 */
export function LaneSummary({
  instrumentId,
  masks,
  playheadStep,
  onExpand,
}: {
  instrumentId: string
  masks: readonly number[]
  playheadStep: number | null
  onExpand: () => void
}) {
  return (
    <div
      className={styles.summary}
      aria-hidden="true"
      data-testid={`lane-summary-${instrumentId}`}
      onClick={onExpand}
    >
      {stepGroups((step) => (
        <div
          key={step}
          className={styles.summaryCell}
          data-parity={Math.floor(step / GROUP_SIZE) % 2 === 0 ? 'even' : 'odd'}
          data-playhead={step === playheadStep}
          data-testid={`lane-summary-cell-${instrumentId}-${step}`}
        >
          {pitchesInMask(masks[step] ?? 0).map((pitchIndex) => (
            <span
              key={pitchIndex}
              className={styles.pebble}
              style={{ '--pebble-offset': pebbleOffset(pitchIndex) } as CSSProperties}
              data-pitch={pitchIndex}
              data-testid={`lane-pebble-${instrumentId}-${step}-${pitchIndex}`}
            />
          ))}
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
function pitchAtPointer(event: { currentTarget: HTMLDivElement; clientY: number }): number | null {
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

interface PitchedRailProps {
  instrumentId: string
  instrumentName: string
  masks: readonly number[]
  collapsed: boolean
  onToggleCollapsed: () => void
  /** The row's name, rendered by the grid so it keeps its hit-bob. */
  children: ReactNode
}

/**
 * A pitched row's rail: the name, then the pitch key - or the mini contour,
 * once the row is folded - with the collapse chevron beside it (ADR 0061).
 */
export function PitchedRail({
  instrumentId,
  instrumentName,
  masks,
  collapsed,
  onToggleCollapsed,
  children,
}: PitchedRailProps) {
  return (
    <span className={styles.railStack}>
      {children}
      <span className={styles.railFoot}>
        {collapsed ? <MiniContour instrumentId={instrumentId} masks={masks} /> : <PitchKey />}
        <LaneToggle
          instrumentId={instrumentId}
          instrumentName={instrumentName}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
        />
      </span>
    </span>
  )
}

/**
 * The chevron that folds a pitched row. The two rails arrange their own lines
 * around it (ADR 0061), so it is a piece rather than part of one layout.
 */
export function LaneToggle({
  instrumentId,
  instrumentName,
  collapsed,
  onToggleCollapsed,
}: {
  instrumentId: string
  instrumentName: string
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? 'Expand' : 'Collapse'} the ${instrumentName} row`}
      data-testid={`lane-toggle-${instrumentId}`}
      onClick={onToggleCollapsed}
    >
      <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
    </button>
  )
}

/** The rail's HIGH/LOW gradient legend - the only pitch key there is (spec §7). */
export function PitchKey() {
  return (
    <span className={styles.pitchKey}>
      <span className={styles.legendEdge}>HIGH</span>
      <span className={styles.legendBar} aria-hidden="true" />
      <span className={styles.legendEdge}>LOW</span>
    </span>
  )
}

/** The four-bar pitch contour a folded row shows in place of its pitch key. */
export function MiniContour({
  instrumentId,
  masks,
}: {
  instrumentId: string
  masks: readonly number[]
}) {
  return (
    <span className={styles.contour} aria-hidden="true">
      {pitchContour(masks).map((pitch, bar) => (
        <span
          key={bar}
          className={styles.contourBar}
          data-pitch={pitch ?? 'off'}
          data-testid={`lane-contour-bar-${instrumentId}-${bar}`}
        />
      ))}
    </span>
  )
}
