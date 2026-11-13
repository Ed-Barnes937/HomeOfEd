import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'

import type { Params } from '../engine/schema.ts'
import { ingredient, INGREDIENTS, type Ingredient } from '../potion/ingredients.ts'
import { MAX_POURS, POUR_KEYS } from '../potion/potionSchema.ts'
import { nextPourKey, pourList } from '../potion/pours.ts'
import type { OnChange } from '../shop/controls/Widgets.tsx'
import styles from './pourPicker.module.scss'

const COUNT_WORDS = ['One', 'Two', 'Three', 'Four']
const FULL_MESSAGE = 'The bottle is full. Take one out to pour another.'

type FocusTarget = { where: { takeOutIndex: number } | 'firstJar'; keyboard: boolean }

/** A click's detail is 0 when Enter or Space made it, and 1 or more for a mouse click or a tap. */
const isKeyboardClick = (event: MouseEvent) => event.detail === 0

/** The one place an ingredient's picture is drawn, for the jars and the pours alike. */
function IngredientPicture({ item }: { item: Ingredient }) {
  return <span className={styles.swatch} style={{ background: item.colour }} aria-hidden="true" />
}

export function PourPicker({ params, onChange }: { params: Params; onChange: OnChange }) {
  const headingId = useId()
  const fullId = useId()
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 })
  const focusAfterChange = useRef<FocusTarget | null>(null)
  const firstJar = useRef<HTMLButtonElement>(null)
  const takeOutButtons = useRef(new Map<number, HTMLButtonElement>())
  const pours = pourList(params)
  const nextKey = nextPourKey(params)
  const slots = Array.from({ length: MAX_POURS }, (_, i) => pours[MAX_POURS - 1 - i])

  const announce = (text: string) => setAnnouncement((last) => ({ text, count: last.count + 1 }))

  useEffect(() => {
    const target = focusAfterChange.current
    focusAfterChange.current = null
    if (!target) return
    const element =
      target.where === 'firstJar'
        ? firstJar.current
        : takeOutButtons.current.get(target.where.takeOutIndex)
    element?.focus({ preventScroll: !target.keyboard })
  })

  const pour = (item: Ingredient) => {
    const count = COUNT_WORDS[pours.length]
    if (nextKey === null || count === undefined) return announce(FULL_MESSAGE)
    onChange(nextKey, item.id)
    announce(`${item.label} poured in. ${count} of four.`)
  }

  const takeOut = (index: number, keyboard: boolean) => {
    onChange(POUR_KEYS[index]!, 'none')
    const remaining = pours.length - 1
    focusAfterChange.current = {
      where: remaining === 0 ? 'firstJar' : { takeOutIndex: Math.min(index, remaining - 1) },
      keyboard,
    }
    announce(`${ingredient(pours[index]!).label} taken out.`)
  }

  const emptyBottle = (keyboard: boolean) => {
    for (let i = pours.length - 1; i >= 0; i--) onChange(POUR_KEYS[i]!, 'none')
    focusAfterChange.current = { where: 'firstJar', keyboard }
    announce('The bottle is empty.')
  }

  return (
    <div className={styles.picker}>
      {nextKey === null && (
        <p className={styles.full} id={fullId}>
          {FULL_MESSAGE}
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
            aria-disabled={nextKey === null}
            aria-describedby={nextKey === null ? fullId : undefined}
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
      <ul className={styles.pours} aria-labelledby={headingId}>
        {slots.map((id, row) => {
          const index = MAX_POURS - 1 - row
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
                ref={(button) => {
                  if (button) takeOutButtons.current.set(index, button)
                  else takeOutButtons.current.delete(index)
                }}
                className={styles.takeOut}
                aria-label={`Take out ${item.label}`}
                onClick={(event) => takeOut(index, isKeyboardClick(event))}
              >
                Take out
              </button>
            </li>
          )
        })}
      </ul>

      {pours.length > 0 && (
        <button type="button" className={styles.emptyAll} onClick={(event) => emptyBottle(isKeyboardClick(event))}>
          Empty the bottle
        </button>
      )}
      <p className="visually-hidden" aria-live="polite">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
    </div>
  )
}
