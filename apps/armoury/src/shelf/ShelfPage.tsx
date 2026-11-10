import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type CSSProperties } from 'react'

import type { StoredWand } from '../persistence/saveFormat.ts'
import { buildShareUrl } from '../share/shareLink.ts'
import { useShareWand } from '../share/useShareWand.ts'
import { inchesInWords, coreName, madeOf, wandName, wandNumber } from '../wand/describe.ts'
import { swatchFor } from '../wand/wandSchema.ts'
import { useWorkbench } from '../workbench/WorkbenchProvider.tsx'
import styles from './ShelfPage.module.scss'

const BOX_TONES = [
  ['#4a3c2e', '#3a2f24'],
  ['#2e3240', '#23262f'],
  ['#33392f', '#272b24'],
  ['#3b2d38', '#2d222b'],
  ['#4a3427', '#3a281e'],
] as const
const PER_SHELF = 3

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

function boxStyle(wand: StoredWand): CSSProperties {
  const [top, bottom] = BOX_TONES[Number(wandNumber(wand.params)) % BOX_TONES.length]!
  const core = swatchFor('core', wand.params.core as string) ?? '#ffc95c'
  return {
    '--box-top': top,
    '--box-bottom': bottom,
    '--seal': core,
    '--seal-rgb': hexToRgb(core),
  } as CSSProperties
}

function ShelfBox({ wand, index }: { wand: StoredWand; index: number }) {
  const { dispatch, renameOnShelf, removeFromShelf } = useWorkbench()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'actions' | 'rename' | 'remove'>('actions')
  const { shareState, share } = useShareWand(() => buildShareUrl(window.location, wand))
  const name = wand.name ?? wandName(wand.params)
  const meta = `${inchesInWords(wand.params.lengthCm as number)}, ${madeOf(wand.params)}, ${coreName(wand.params.core as string).toLowerCase()}`

  return (
    <li className={styles.slot} data-open={open} style={boxStyle(wand)}>
      <button
        type="button"
        className={styles.box}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setMode('actions')
        }}
      >
        <span className={styles.label}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{name}</span>
            <span className={styles.number}>No. {wandNumber(wand.params)}</span>
          </span>
          <span className={styles.meta}>{meta}</span>
        </span>
        <span className={styles.seal} aria-hidden="true" />
      </button>
      {open && mode === 'actions' && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              dispatch({ type: 'load', wand })
              void navigate({ to: '/' })
            }}
          >
            Take it out
          </button>
          <button type="button" className={styles.action} onClick={share}>
            {shareState === 'copied' ? 'Copied!' : 'Share'}
          </button>
          <button type="button" className={styles.action} onClick={() => setMode('rename')}>
            Rename
          </button>
          <button type="button" className={styles.action} onClick={() => setMode('remove')}>
            Remove
          </button>
        </div>
      )}
      {open && mode === 'rename' && (
        <form
          className={styles.actions}
          onSubmit={(e) => {
            e.preventDefault()
            const input = new FormData(e.currentTarget).get('name')
            renameOnShelf(index, typeof input === 'string' ? input : '')
            setMode('actions')
          }}
        >
          <input
            className={styles.input}
            name="name"
            aria-label="New name"
            defaultValue={name}
            maxLength={40}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="submit" className={styles.primary}>
            Save name
          </button>
        </form>
      )}
      {open && mode === 'remove' && (
        <div className={styles.actions}>
          <span className={styles.question}>Take {name} off the shelf for good?</span>
          <button type="button" className={styles.action} onClick={() => setMode('actions')}>
            Keep it
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => {
              removeFromShelf(index)
              setOpen(false)
            }}
          >
            Remove
          </button>
        </div>
      )}
    </li>
  )
}

export function ShelfPage() {
  const { shelf } = useWorkbench()
  const rows: { wand: StoredWand; index: number }[][] = []
  shelf.forEach((wand, index) => {
    if (index % PER_SHELF === 0) rows.push([])
    rows[rows.length - 1]!.push({ wand, index })
  })
  const roomOnLastShelf = rows.length === 0 || rows[rows.length - 1]!.length < PER_SHELF
  if (!roomOnLastShelf) rows.push([])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back} aria-label="Back to the counter">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12.5 4 L6.5 10 L12.5 16" />
          </svg>
        </Link>
        <h1 className={styles.title}>Your shelf</h1>
        <span className={styles.count}>
          {shelf.length} {shelf.length === 1 ? 'wand' : 'wands'}
        </span>
      </header>
      <p className={styles.intro}>Every wand you keep gets a box and a label.</p>

      <div className={styles.shelves}>
        {rows.map((row, r) => (
          <div key={r} className={styles.shelf}>
            <ul className={styles.boxes}>
              {row.map(({ wand, index }) => (
                <ShelfBox
                  key={`${index}-${wandNumber(wand.params)}-${wand.name ?? ''}`}
                  wand={wand}
                  index={index}
                />
              ))}
              {r === rows.length - 1 && (
                <li className={styles.empty}>
                  {shelf.length === 0
                    ? 'Keep a wand and its box goes here'
                    : 'Room for the next one'}
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <Link to="/" className={styles.counterButton}>
          Back to the counter
        </Link>
      </footer>
    </div>
  )
}
