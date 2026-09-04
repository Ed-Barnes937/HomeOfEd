/**
 * The moment card (spec §6): one component, two contents - a discovery and a
 * mastery unlock - bottom-left over the canvas, opposite the run pill. What it
 * says, and whether a name may be said at all, is `moments.ts`'s business; this
 * only puts it on screen.
 *
 * It is an announcement, not a control: nothing in it is clickable and it never
 * takes the pointer, so a card arriving mid-stroke cannot interrupt the world.
 */
import { useMemo } from 'react'

import type { ElementRegistry } from '../../sim/index.ts'
import { elementAppearances } from './elementAppearance.ts'
import { ElementRefTile } from './ElementTile.tsx'
import type { Moment } from './moments.ts'
import styles from './MomentCard.module.scss'

/** The card's tile size - the ring's, the biggest the tile helper draws small. */
const TILE_SIZE = 40

export interface MomentCardProps {
  moment: Moment
  /** The registry the canvas paints from, so a tile is the colour of its cells. */
  registry: ElementRegistry
  /** The card's last beat, on its way out. */
  leaving: boolean
}

export function MomentCard(props: MomentCardProps) {
  const appearances = useMemo(() => elementAppearances(props.registry), [props.registry])

  return (
    <div
      className={`${styles.card} ${props.leaving ? styles.leaving : ''}`}
      data-testid="field-notes-moment"
      data-kind={props.moment.kind}
      // Polite: the world is busy, and this is never urgent.
      role="status"
      aria-live="polite"
    >
      <span className={styles.tiles}>
        {props.moment.tiles.map((element) => (
          <ElementRefTile
            key={element.name}
            element={element}
            appearances={appearances}
            size={TILE_SIZE}
            fresh={props.moment.fresh}
          />
        ))}
      </span>
      <span className={styles.words}>
        <span className={styles.lead}>{props.moment.lead}</span>
        <span className={styles.title}>{props.moment.title}</span>
      </span>
    </div>
  )
}
