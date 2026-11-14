import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'

import type { Params } from '../engine/schema.ts'
import { ingredient, INGREDIENTS, type Ingredient } from '../potion/ingredients.ts'
import { isMixed, MAX_POURS, POUR_KEYS } from '../potion/potionSchema.ts'
import { nextPourKey, pourList } from '../potion/pours.ts'
import type { OnChange } from '../shop/controls/Widgets.tsx'
import styles from './pourPicker.module.scss'

const COUNT_WORDS = ['One', 'Two', 'Three']
const FULL_MESSAGE = 'The bottle is full. Tap it to mix it, or empty it to start again.'
const MIXED_MESSAGE = 'This potion is mixed. Empty the bottle to make a new one.'

/** A click's detail is 0 when no pointer made it: Enter, Space or a screen reader's click. */
const isPointerlessClick = (event: MouseEvent) => event.detail === 0

/** The one place an ingredient's picture is drawn, for the jars and the pours alike. */
function IngredientPicture({ item }: { item: Ingredient }) {
  return <span className={styles.swatch} style={{ background: item.colour }} aria-hidden="true" />
}

export function PourPicker({ params, onChange }: { params: Params; onChange: OnChange }) {
  const headingId = useId()
  const reasonId = useId()
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 })
  const focusFirstJar = useRef<{ scroll: boolean } | null>(null)
  const firstJar = useRef<HTMLButtonElement>(null)
  const pours = pourList(params)
  const nextKey = nextPourKey(params)
  const mixed = isMixed(params)
  const shutReason = mixed ? MIXED_MESSAGE : nextKey === null ? FULL_MESSAGE : null
  const rows = Array.from({ length: MAX_POURS }, (_, row) => pours[MAX_POURS - 1 - row])

  const announce = (text: string) => setAnnouncement((last) => ({ text, count: last.count + 1 }))

  useEffect(() => {
    const target = focusFirstJar.current
    focusFirstJar.current = null
    if (target) firstJar.current?.focus({ preventScroll: !target.scroll })
  })

  const pour = (item: Ingredient) => {
    if (shutReason !== null) return announce(shutReason)
    if (nextKey === null) return
    onChange(nextKey, item.id)
    const filled = pours.length + 1
    const count = `${COUNT_WORDS[filled - 1]} of three.`
    const mixHint = filled === MAX_POURS ? ' Tap the bottle to mix it.' : ''
    announce(`${item.label} poured in. ${count}${mixHint}`)
  }

  const emptyBottle = (scroll: boolean) => {
    for (let i = pours.length - 1; i >= 0; i--) onChange(POUR_KEYS[i]!, 'none')
    focusFirstJar.current = { scroll }
    announce('The bottle is empty.')
  }

  return (
    <div className={styles.picker}>
      {shutReason !== null && (
        <p className={styles.reason} id={reasonId}>
          {shutReason}
        </p>
      )}
      <div className={styles.jars}>
        {INGREDIENTS.map((item, i) => (
          <button
            key={item.id}
            ref={i === 0 ? firstJar : undefined}
            type="button"
            className={styles.jar}
            aria-label={`Pour in ${item.label}`}
            aria-disabled={shutReason !== null}
            aria-describedby={shutReason !== null ? reasonId : undefined}
            onClick={() => pour(item)}
          >
            <IngredientPicture item={item} />
            <span aria-hidden="true">{item.label}</span>
          </button>
        ))}
      </div>

      <h3 className={styles.heading} id={headingId}>
        {mixed ? 'Mixed in the bottle' : 'In the bottle'}
      </h3>
      <ul className={styles.pours} aria-labelledby={headingId}>
        {rows.map((id, row) =>
          id === undefined ? (
            <li key={`empty-${row}`} className={`${styles.row} ${styles.emptyRow}`}>
              Empty
            </li>
          ) : (
            <li key={`${row}-${id}`} className={styles.row}>
              <IngredientPicture item={ingredient(id)} />
              <span className={styles.rowLabel}>{ingredient(id).label}</span>
            </li>
          ),
        )}
      </ul>

      {pours.length > 0 && (
        <button
          type="button"
          className={styles.emptyAll}
          onClick={(event) => emptyBottle(isPointerlessClick(event))}
        >
          Empty the bottle
        </button>
      )}
      <p className="visually-hidden" aria-live="polite">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
    </div>
  )
}
