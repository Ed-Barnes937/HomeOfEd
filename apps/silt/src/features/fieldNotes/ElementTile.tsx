/**
 * **The** element tile (spec §6 "Element tiles"). Every tile Field notes draws -
 * the picker row, the phone's tile grid, the ring, the product tiles under a
 * spoke's words, the rail's teaser - comes from this one component, built from
 * the element's colour and archetype alone. That is what keeps a 22px picker
 * tile and a 40px ring tile from drifting apart, and what means a new element
 * needs no art.
 *
 * It is decorative: it carries no text of its own beyond the `?` of a hidden
 * element, so whatever wraps it owns the accessible name.
 */
import type { CSSProperties } from 'react'

import type { ElementAppearances, TileShape } from './elementAppearance.ts'
import type { ElementRef } from './panelModel.ts'
import styles from './ElementTile.module.scss'

/** The sizes the design uses: products, picker row, phone picker, ring, ring centre. */
export type TileSize = 18 | 22 | 30 | 40 | 56

/** Where the ink plate thickens: the two big tiles carry a 3px edge, the rest 2px. */
const THICK_EDGE_FROM = 34

export interface ElementTileProps {
  shape: TileShape
  /**
   * The element's base colour, or `undefined` for an element the chart is
   * hiding - which is the only way a tile is ever drawn dark. A hex is a
   * spoiler as surely as a name is (spec §7), so callers pass `ElementRefTile`
   * a ref and let it decide.
   */
  hex?: string
  size: TileSize
  /** Discovered since the panel was last closed: the plate edge turns live green. */
  fresh?: boolean
}

export function ElementTile(props: ElementTileProps) {
  const hidden = props.hex === undefined
  const plate = [
    styles.plate,
    styles[props.shape],
    hidden ? styles.hidden : '',
    // Green wins over the faded edge: a hidden element is never new (it has not
    // been discovered), so the two cannot actually collide - but the rule is
    // worth having in one place rather than in every caller.
    props.fresh ? styles.fresh : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={plate}
      aria-hidden="true"
      style={
        {
          '--tile-size': `${props.size}px`,
          '--tile-pad': props.size >= THICK_EDGE_FROM ? '3px' : '2px',
        } as CSSProperties
      }
    >
      {/* No colour at all for a hidden element - the stylesheet's dark fill is
          what shows through, so its hex never reaches the DOM (spec §7). */}
      <span
        className={`${styles.fill} ${styles[props.shape]}`}
        style={props.hex === undefined ? undefined : { backgroundColor: props.hex }}
      >
        {hidden ? '?' : ''}
      </span>
    </span>
  )
}

export interface ElementRefTileProps {
  element: ElementRef
  appearances: ElementAppearances
  size: TileSize
  fresh?: boolean
}

/**
 * The tile for one element of the panel's model. The single place that decides
 * whether a colour may be drawn, so no call site can leak a hidden element's
 * hex by passing the wrong thing (spec §7).
 */
export function ElementRefTile(props: ElementRefTileProps) {
  const look = props.appearances.get(props.element.name)
  return (
    <ElementTile
      shape={look?.shape ?? 'static'}
      hex={props.element.discovered ? look?.hex : undefined}
      size={props.size}
      fresh={props.fresh}
    />
  )
}
