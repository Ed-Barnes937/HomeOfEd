/**
 * The Field notes panel (spec §6): counters, the element picker, and one
 * element's ring. Desktop gets an overlay in the scenes popover's chrome; a
 * phone gets the same DOM as a full-screen sheet, which is why there is one
 * component and not two.
 *
 * It renders derived data and dispatches selection, nothing more - the
 * witnessed set, the counts and the masking all arrive from `useFieldNotes`'s
 * view, so the panel knows nothing about storage or the engine. The graph is
 * never shown whole: the ring holds one element at a time, so the picture does
 * not get busier as the roster grows (decision 7).
 */
import { useMemo, useState, type CSSProperties } from 'react'

import { useArmedConfirm } from '../../hooks/useArmedConfirm.ts'
import { useMobileLayout } from '../../hooks/useMobileLayout.ts'
import type { ElementRegistry } from '../../sim/index.ts'
import { ElementRefTile, ElementTile, type TileSize } from './ElementTile.tsx'
import { elementAppearances, elementTags, type ElementAppearances } from './elementAppearance.ts'
import type { FieldNotesView } from './fieldNotesView.ts'
import { pickerRows, ringFor, type ElementRef, type Spoke } from './panelModel.ts'
import {
  arrowPoints,
  outcomePoint,
  RING,
  spokeLine,
  spokePoint,
  type RingPoint,
} from './ringGeometry.ts'
import styles from './FieldNotesPanel.module.scss'

export interface FieldNotesPanelProps {
  view: FieldNotesView
  /** The sim's own registry: element colours and archetypes come from it, never from `v1Elements`. */
  registry: ElementRegistry
  onClose: () => void
  /** "Forget discoveries" - already behind this panel's armed confirm. */
  onForget: () => void
}

/** Places an element of the ring at its point in the 0-100 box. */
function at(x: number, y: number): CSSProperties {
  return { left: `${x}%`, top: `${y}%` }
}

/** The drawn star that marks a mastered element - no colour, no badge (spec §6). */
function MasteryStar() {
  return (
    <svg className={styles.star} viewBox="0 0 10 10" role="img" aria-label="mastered">
      <path
        d="M5 0 L6.2 3.4 L9.8 3.4 L6.9 5.7 L8 9.4 L5 7.1 L2 9.4 L3.1 5.7 L0.2 3.4 L3.8 3.4 Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function FieldNotesPanel(props: FieldNotesPanelProps) {
  const appearances = useMemo(() => elementAppearances(props.registry), [props.registry])
  // The raw sim tags; `panelModel` decides which of them a player ever reads.
  const tags = useMemo(() => elementTags(props.registry), [props.registry])
  const rows = useMemo(() => pickerRows(props.view), [props.view])

  // Panel-local, both of them: which element the ring holds, and which rows
  // have had their "new" edge answered by being looked at. Neither is progress,
  // so neither is stored - closing the panel reviews everything anyway.
  const [selected, setSelected] = useState<string | null>(null)
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set())
  const forget = useArmedConfirm<true>()
  // The one thing the breakpoint cannot do in CSS: the picker's tile is a
  // number handed to the helper, 22px in the desktop column and 30px in the
  // phone's tile grid (spec §6).
  const pickerTile: TileSize = useMobileLayout() ? 30 : 22

  const focus = selected ?? rows.find((row) => row.discovered)?.name ?? null
  const ring = useMemo(
    () => (focus ? ringFor(focus, props.view, tags) : null),
    [focus, props.view, tags],
  )
  // Nothing witnessed at all is the empty state, not a ring with no spokes:
  // there is no entry count to give, nothing left to find that means anything,
  // and nothing to forget either, so the footer goes with it.
  const chart = props.view.totals.interactions.seen > 0 ? ring : null

  const select = (name: string): void => {
    setSelected(name)
    setCleared((current) => new Set(current).add(name))
  }

  const armForget = (): void => {
    if (!forget.armed) {
      forget.arm(true)
      return
    }
    forget.disarm()
    setSelected(null)
    setCleared(new Set())
    props.onForget()
  }

  const { elements, interactions } = props.view.totals

  const tileFor = (element: ElementRef, size: TileSize, fresh = false) => (
    <ElementRefTile element={element} appearances={appearances} size={size} fresh={fresh} />
  )

  return (
    <div className={styles.scrim} data-testid="field-notes-scrim" onClick={props.onClose}>
      {/* The scrim closes the panel; a click inside it must not. */}
      <div
        className={styles.panel}
        data-testid="field-notes-panel"
        role="dialog"
        aria-label="field notes"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}>Field notes</span>
          <div className={styles.counters}>
            {props.view.newElements.size > 0 ? (
              <span className={styles.newChip} data-testid="field-notes-new">
                <span className={styles.newMark} aria-hidden="true" />
                <span className={styles.counterLabel}>new</span>
                <span className={styles.counterValue}>{props.view.newElements.size}</span>
              </span>
            ) : null}
            <span className={styles.counter} data-testid="field-notes-elements">
              <span className={styles.counterLabel}>elements</span>
              <span className={styles.counterValue}>
                {elements.seen}/{elements.total}
              </span>
            </span>
            <span className={styles.counter} data-testid="field-notes-interactions">
              <span className={styles.counterLabel}>interactions</span>
              <span
                className={`${styles.counterValue} ${interactions.seen === 0 ? styles.zero : ''}`}
              >
                {interactions.seen}/{interactions.total}
              </span>
            </span>
            <button
              type="button"
              className={styles.close}
              data-testid="field-notes-close"
              aria-label="close field notes"
              onClick={props.onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.picker} data-testid="field-notes-picker">
            <span className={styles.pickerLabel}>Elements</span>
            {rows.map((row) => (
              <button
                key={row.name}
                type="button"
                className={styles.row}
                // Test ids are keyed by the real name, hidden rows included.
                // The spoiler policy is about what the panel *says* - its text
                // and its accessible names, which `panelModel` masks; the
                // roster itself ships in the bundle either way, so hashing the
                // hooks the tests hang off would buy nothing and cost the one
                // selector that can assert a hidden row is inert.
                data-testid={`field-notes-row-${row.name}`}
                // An undiscovered element keeps its slot, its shape and its
                // position, and nothing else: it is not selectable (spec §7).
                disabled={!row.discovered}
                aria-pressed={focus === row.name}
                onClick={() => select(row.name)}
              >
                {tileFor(row, pickerTile, row.isNew && !cleared.has(row.name))}
                <span className={styles.rowName}>
                  {row.label}
                  {row.mastered ? <MasteryStar /> : null}
                </span>
                <span className={styles.rowCount}>{row.count}</span>
              </button>
            ))}
          </div>

          {chart === null ? (
            <div className={styles.empty} data-testid="field-notes-empty">
              <ElementTile shape="static" size={56} />
              <span className={styles.emptyTitle}>nothing witnessed yet</span>
              <span className={styles.emptyBody}>
                {/* Nothing witnessed means nothing has been discovered either,
                    so the elements counter is exactly the rail you can paint. */}
                pick an element on the left to see what it does. the {elements.seen} you can paint
                are already known - put two of them in the same place and watch.
              </span>
            </div>
          ) : (
            <div className={styles.ringWrap}>
              <div className={styles.ring} data-testid="field-notes-ring">
                <svg className={styles.spokes} viewBox="0 0 100 100" aria-hidden="true">
                  {chart.spokes.map((spoke, index) => {
                    const point = spokePoint(index, chart.spokes.length)
                    const { from, to } = spokeLine(point)
                    return (
                      <g key={spoke.key} className={styles[spoke.kind]}>
                        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                        {spoke.direction === 'out' ? (
                          <polygon points={arrowPoints(to.x, to.y, point.ux, point.uy)} />
                        ) : null}
                        {spoke.direction === 'in' ? (
                          <polygon points={arrowPoints(from.x, from.y, -point.ux, -point.uy)} />
                        ) : null}
                      </g>
                    )
                  })}
                </svg>

                <span className={styles.centre} style={at(RING.centre, RING.centre)}>
                  {tileFor(chart.centre, 56)}
                </span>
                <span className={styles.centreName} style={at(RING.centre, RING.centre)}>
                  <span data-testid="field-notes-centre">{chart.centre.label}</span>
                  {chart.mastered ? <MasteryStar /> : null}
                </span>
                {/* The focused element's sim tags, under its name (ticket 12).
                    `panelModel` withholds them from anything undiscovered, so
                    there is no spoiler check to repeat here. */}
                {chart.centre.tags?.length ? (
                  <span
                    className={styles.centreTags}
                    style={at(RING.centre, RING.centre)}
                  >
                    {chart.centre.tags.map((tag) => (
                      <span key={tag} className={styles.tagChip} data-testid="field-notes-tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}

                {chart.spokes.map((spoke, index) => (
                  <SpokeView
                    key={spoke.key}
                    spoke={spoke}
                    point={spokePoint(index, chart.spokes.length)}
                    appearances={appearances}
                    onSelect={select}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The footer belongs to the ring: an empty chart has no entry count,
            nothing left to find that means anything, and nothing to forget. */}
        {chart ? (
          <div className={styles.foot}>
            <span className={styles.footText} data-testid="field-notes-seen">
              {`${chart.seen} ${chart.seen === 1 ? 'entry' : 'entries'} for ${chart.centre.label}`}
              <span className={styles.footHint}> · tap any small tile to follow it</span>
            </span>

            <span className={styles.footRight}>
              <span className={styles.counterLabel}>still to find</span>
              {/* The notches carry what is left without naming any of it
                  (spec §7, decision 9). */}
              <span className={styles.notches} aria-hidden="true">
                {Array.from({ length: chart.stillToFind }, (_, index) => (
                  <span key={index} className={styles.notch} />
                ))}
              </span>
              <span className={styles.footCount} data-testid="field-notes-still-to-find">
                {chart.stillToFind}
              </span>
              <button
                type="button"
                className={`${styles.forget} ${forget.armed ? styles.armed : ''}`}
                data-testid="field-notes-forget"
                onClick={armForget}
              >
                {forget.armed ? 'sure?' : 'forget discoveries'}
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface SpokeViewProps {
  spoke: Spoke
  point: RingPoint
  appearances: ElementAppearances
  onSelect: (name: string) => void
}

/** One witnessed entry: its partner on the ring, its outcome on the line. */
function SpokeView(props: SpokeViewProps) {
  const { appearances, spoke, point } = props
  const outcome = outcomePoint(point)

  return (
    <>
      <button
        type="button"
        className={styles.spokeTile}
        style={at(point.x, point.y)}
        data-testid={`field-notes-spoke-${spoke.partner.name}`}
        disabled={!spoke.partner.discovered}
        aria-label={spoke.partner.label}
        onClick={() => props.onSelect(spoke.partner.name)}
      >
        <ElementRefTile element={spoke.partner} appearances={appearances} size={40} />
      </button>
      <span className={styles.spokeName} style={at(point.x, point.y)}>
        {spoke.partner.label}
      </span>
      <span className={styles.spokeOutcome} style={at(outcome.x, outcome.y)}>
        {spoke.outcome}
      </span>
      <span className={styles.spokeTiles} style={at(outcome.x, outcome.y)}>
        {spoke.tiles.map((product) => (
          <button
            key={product.name}
            type="button"
            className={styles.productTile}
            data-testid={`field-notes-product-${product.name}`}
            disabled={!product.discovered}
            aria-label={product.label}
            onClick={() => props.onSelect(product.name)}
          >
            <ElementRefTile element={product} appearances={appearances} size={18} />
          </button>
        ))}
      </span>
    </>
  )
}
