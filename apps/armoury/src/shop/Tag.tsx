import { useState } from 'react'

import styles from './Tag.module.scss'

export function Tag({
  number,
  name,
  description,
  onRename,
}: {
  number: string
  name: string
  description: string
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className={styles.tag}>
      <div className={styles.paper}>
        <span className={styles.hole} aria-hidden="true" />
        <p className={styles.number}>No. {number}</p>
        {editing ? (
          <input
            className={styles.nameInput}
            aria-label="Wand name"
            defaultValue={name}
            maxLength={40}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              onRename(e.currentTarget.value)
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <h1 className={styles.name}>
            <button type="button" className={styles.nameButton} onClick={() => setEditing(true)}>
              {name}
              <span className="visually-hidden">, rename</span>
            </button>
          </h1>
        )}
        <p className={styles.description}>{description}</p>
      </div>
    </div>
  )
}
