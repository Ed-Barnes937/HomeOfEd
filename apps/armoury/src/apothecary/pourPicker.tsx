import { useId, useState } from 'react'

import type { Params } from '../engine/schema.ts'
import { ingredient, INGREDIENTS, type Ingredient } from '../potion/ingredients.ts'
import { MAX_POURS, POUR_KEYS } from '../potion/potionSchema.ts'
import { nextPourKey, pourList } from '../potion/pours.ts'
import type { OnChange } from '../shop/controls/Widgets.tsx'
import styles from './pourPicker.module.scss'

const COUNT_WORDS = ['One', 'Two', 'Three', 'Four']

/** The one place an ingredient's picture is drawn, for the jars and the pours alike. */
function IngredientPicture({ item }: { item: Ingredient }) {
  return <span className={styles.swatch} style={{ background: item.colour }} aria-hidden="true" />
}

export function PourPicker({ params, onChange }: { params: Params; onChange: OnChange }) {
  const headingId = useId()
  const [announcement, setAnnouncement] = useState('')
  const pours = pourList(params)
  const nextKey = nextPourKey(params)
  const slots = Array.from({ length: MAX_POURS }, (_, i) => pours[MAX_POURS - 1 - i])

  const pour = (item: Ingredient) => {
    if (nextKey === null) return
    onChange(nextKey, item.id)
    setAnnouncement(`${item.label} poured in. ${COUNT_WORDS[pours.length]} of four.`)
  }

  const takeOut = (index: number) => {
    onChange(POUR_KEYS[index]!, 'none')
    setAnnouncement(`${ingredient(pours[index]!).label} taken out.`)
  }

  const emptyBottle = () => {
    for (let i = pours.length - 1; i >= 0; i--) onChange(POUR_KEYS[i]!, 'none')
    setAnnouncement('The bottle is empty.')
  }

  return (
    <div className={styles.picker}>
      {nextKey === null && (
        <p className={styles.full}>The bottle is full. Take one out to pour another.</p>
      )}
      <div className={styles.jars}>
        {INGREDIENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.jar}
            aria-label={`Pour in ${item.label}`}
            aria-disabled={nextKey === null}
            onClick={() => pour(item)}
          >
            <IngredientPicture item={item} />
            <span aria-hidden="true">{item.label}</span>
          </button>
        ))}
      </div>

      <h3 className={styles.heading} id={headingId}>
        In the bottle
      </h3>
      <ol className={styles.pours} aria-labelledby={headingId}>
        {slots.map((id, row) => {
          if (id === undefined)
            return (
              <li key={`empty-${row}`} className={styles.emptyRow}>
                Empty
              </li>
            )
          const item = ingredient(id)
          return (
            <li key={`${row}-${id}`} className={styles.row}>
              <IngredientPicture item={item} />
              <span className={styles.rowLabel}>{item.label}</span>
              <button
                type="button"
                className={styles.takeOut}
                aria-label={`Take out ${item.label}`}
                onClick={() => takeOut(MAX_POURS - 1 - row)}
              >
                Take out
              </button>
            </li>
          )
        })}
      </ol>

      {pours.length > 0 && (
        <button type="button" className={styles.emptyAll} onClick={emptyBottle}>
          Empty the bottle
        </button>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
