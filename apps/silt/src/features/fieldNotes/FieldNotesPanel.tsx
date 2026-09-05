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
import {
  LEGEND_RULES,
  legendRows,
  pickerRows,
  ringFor,
  strokeOf,
  type ElementRef,
  type Spoke,
} from './panelModel.ts'
import {
  arrowPoints,
  labelPoint,
  RING,
  RING_MIN_PX,
  RING_TILES,
  spokeLine,
  spokePoint,
  tileSide,
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

/**
 * The focused element's name, wherever the layout puts it: the ring's centre on
 * a desktop, the sheet's header band on a phone (ticket 21). One component so
 * the two places cannot drift, and one `field-notes-centre` in the document
 * either way - the name is moved, not duplicated and half-hidden.
 */
function FocusName(props: { centre: ElementRef; mastered: boolean }) {
  return (
    <>
      <span data-testid="field-notes-centre">{props.centre.label}</span>
      {props.mastered ? <MasteryStar /> : null}
    </>
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
  // The key is collapsed by default and remembers nothing (ticket 11): the
  // panel unmounts on close, so there is no state to clear either.
  const [keyOpen, setKeyOpen] = useState(false)
  const forget = useArmedConfirm<true>()
  // The two things the breakpoint cannot do in CSS. The picker's tile is a
  // *number* handed to the helper, 22px in the desktop column and 30px in the
  // phone's tile grid (spec §6). The focused element's name is a *place*: it
  // reads in the ring's centre on a desktop and in a band above the ring on a
  // phone (ticket 21), and one name in one place beats two nodes with one of
  // them hidden - there is a single `field-notes-centre` either way.
  const phone = useMobileLayout()
  const pickerTile: TileSize = phone ? 30 : 22

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
              {/* The phone's header band: the focused element named where it
                  can be read, rather than in the middle of the tiles. */}
              {phone ? (
                <span className={styles.ringHead}>
                  <FocusName centre={chart.centre} mastered={chart.mastered} />
                </span>
              ) : null}

              <div
                className={styles.ring}
                data-testid="field-notes-ring"
                // The floor the sheet's ring is sized against, from the module
                // that works the tile capacity out at it - handed over rather
                // than written down twice, as `.spokeStack`'s numbers are.
                style={{ '--ring-min': `${RING_MIN_PX}px` } as CSSProperties}
              >
                <svg className={styles.spokes} viewBox="0 0 100 100" aria-hidden="true">
                  {chart.spokes.map((spoke, index) => {
                    const point = spokePoint(index, chart.spokes.length)
                    const { from, to } = spokeLine(point)
                    return (
                      <g
                        key={spoke.key}
                        className={styles[strokeOf(spoke.kind)]}
                        data-testid="field-notes-line"
                      >
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
                {phone ? null : (
                  <span className={styles.centreName} style={at(RING.centre, RING.centre)}>
                    <FocusName centre={chart.centre} mastered={chart.mastered} />
                  </span>
                )}
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
            <div className={styles.footBar}>
              <span className={styles.footText} data-testid="field-notes-seen">
                {`${chart.seen} ${chart.seen === 1 ? 'entry' : 'entries'} for ${chart.centre.label}`}
                <span className={styles.footHint}> · tap any small tile to follow it</span>
              </span>

              <span className={styles.footRight}>
                {/* The key leads the footer's controls (ticket 22). It sat last,
                    behind a strip of up to twenty-two notches, at the same 8px
                    as `forget discoveries` - which is how a control that was
                    there all along went unfound. It stays with the ring: line
                    kinds are the only thing it explains, and a panel with no
                    ring on it draws none of them. */}
                <button
                  type="button"
                  className={`${styles.keyToggle} ${keyOpen ? styles.keyOpen : ''}`}
                  data-testid="field-notes-key-toggle"
                  aria-expanded={keyOpen}
                  onClick={() => setKeyOpen((open) => !open)}
                >
                  <span className={styles.keyMark} aria-hidden="true">
                    ?
                  </span>
                  Key
                </button>
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

            {keyOpen ? <LegendBlock /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The key (ticket 11): what the chart's small visual language means, in static
 * text about line kinds alone. The rows come from the derived graph, so a kind
 * with a stroke of its own joins the key for free; the samples wear the ring's
 * own kind classes, so a stroke cannot be drawn one way here and another there.
 *
 * It names nothing, which is what makes it immune to the spoiler policy (§7)
 * rather than merely compliant with it.
 */
function LegendBlock() {
  const rows = useMemo(() => legendRows(), [])

  return (
    <div className={styles.legend} data-testid="field-notes-key">
      {rows.map((row) => (
        <span
          key={row.stroke}
          className={styles.legendRow}
          data-testid={`field-notes-key-${row.stroke}`}
        >
          <svg
            className={`${styles.sample} ${styles[row.stroke]}`}
            viewBox="0 0 24 8"
            aria-hidden="true"
          >
            <line x1="1" y1="4" x2="23" y2="4" />
          </svg>
          <span className={styles.legendLabel}>{row.label}</span>
          <span className={styles.legendMeaning}>{row.meaning}</span>
        </span>
      ))}

      {LEGEND_RULES.map((rule) => (
        <span
          key={rule.id}
          // The notches are a desktop affordance - the phone's footer has no
          // room for them and drops them for the bare count - so the key drops
          // that row with them rather than teaching a mark the sheet never
          // draws. Same principle as deriving the kinds: only what is drawn.
          className={`${styles.legendRow} ${rule.id === 'notch' ? styles.notchRule : ''}`}
          data-testid={`field-notes-key-${rule.id}`}
        >
          {rule.id === 'arrow' ? (
            <svg className={styles.sample} viewBox="0 0 24 8" aria-hidden="true">
              <line x1="8" y1="4" x2="23" y2="4" />
              <polygon points="1,4 8,1.6 8,6.4" />
            </svg>
          ) : (
            <span className={styles.sample} aria-hidden="true">
              <span className={styles.notch} />
            </span>
          )}
          <span className={styles.legendMeaning}>{rule.text}</span>
        </span>
      ))}
    </div>
  )
}

interface SpokeViewProps {
  spoke: Spoke
  point: RingPoint
  appearances: ElementAppearances
  onSelect: (name: string) => void
}

/**
 * One drawn spoke: its partner on the ring, its outcome on the line. When the
 * ring was too crowded to give every pair its own spoke (ticket 09) the partner
 * position carries the group's stack of member tiles and a `2/5` chip instead
 * of one tile and a name - every member still its own control, so a discovered
 * one is still the way into its entry.
 */
function SpokeView(props: SpokeViewProps) {
  const { appearances, spoke, point } = props
  // One point for the words and the tiles that hang off them, and it steps
  // clear of the arrowheads rather than sitting on one (`labelPoint`).
  const outcome = labelPoint(point)
  // The tiles take the side of that point the outward head is not on, so they
  // clear it at every angle rather than only on the ring's upper half
  // (ticket 17, absorbed into 09).
  const above = tileSide(point) < 0

  return (
    <>
      {spoke.group ? (
        <span
          className={styles.spokeStack}
          // The two numbers the stylesheet needs to lay the stack out are the
          // two the capacity was derived from, so they are handed over rather
          // than written down twice (`ringGeometry.RING_TILES`).
          style={{
            ...at(point.x, point.y),
            '--stack-columns': RING_TILES.columns,
            '--stack-gap': `${RING_TILES.gap}px`,
          } as CSSProperties}
        >
          {spoke.group.members.map((member) => (
            <button
              key={member.key}
              type="button"
              className={styles.memberTile}
              data-testid={`field-notes-spoke-${member.name}`}
              disabled={!member.discovered}
              aria-label={member.label}
              onClick={() => props.onSelect(member.name)}
            >
              <ElementRefTile element={member} appearances={appearances} size={RING_TILES.member} />
            </button>
          ))}
          {/* The pairs behind the stack, counted and never named - the
              still-to-find notches' own rule, said for one spoke (spec §7,
              decision 9). It hangs off the stack rather than off the ring
              point, so it stays under a stack of any height. */}
          <span className={styles.spokeCount} data-testid="field-notes-group-count">
            {spoke.group.seen}/{spoke.group.total}
          </span>
        </span>
      ) : (
        // The plain spoke: one tile and the partner's name under it. A group
        // has no one partner to name, which is what its chip stands in for.
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
            <ElementRefTile element={spoke.partner} appearances={appearances} size={RING_TILES.spoke} />
          </button>
          <span className={styles.spokeName} style={at(point.x, point.y)}>
            {spoke.partner.label}
          </span>
        </>
      )}
      <span className={styles.spokeOutcome} style={at(outcome.x, outcome.y)}>
        {spoke.outcome}
      </span>
      <span
        className={`${styles.spokeTiles} ${above ? styles.above : ''}`}
        data-testid="field-notes-tiles"
        style={at(outcome.x, outcome.y)}
      >
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
