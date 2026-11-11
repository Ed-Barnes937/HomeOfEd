import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type CSSProperties } from 'react'

import type { ItemKind, StoredItem } from '../items/item.ts'
import { buildShareUrl } from '../share/shareLink.ts'
import { useShareWand } from '../share/useShareWand.ts'
import type { ShopView } from '../shop/shopView.ts'
import { wandShop } from '../shop/wandShop.ts'
import { smithy } from '../smithy/smithy.ts'
import { SwordOutline } from '../smithy/SwordOutline.tsx'
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

interface Shelf {
  view: ShopView
  heading: string
  /** Where "Take it out" goes: the wand shop stays at the root for now. */
  to: '/' | '/swords'
}

const SHELVES: readonly Shelf[] = [
  { view: wandShop, heading: 'Wands', to: '/' },
  { view: smithy, heading: 'Swords', to: '/swords' },
]

function boxStyle({ view }: Shelf, item: StoredItem): CSSProperties {
  const [top, bottom] = BOX_TONES[Number(view.item.number(item.params)) % BOX_TONES.length]!
  const glow = view.item.glow(item.params)
  return {
    '--box-top': top,
    '--box-bottom': bottom,
    '--seal': glow,
    '--seal-rgb': hexToRgb(glow),
  } as CSSProperties
}

function ShelfBox({ shelf, item, index }: { shelf: Shelf; item: StoredItem; index: number }) {
  const { item: def, copy } = shelf.view
  const { dispatch, renameOnShelf, removeFromShelf } = useWorkbench(def.kind)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'actions' | 'rename' | 'remove'>('actions')
  const { shareState, share } = useShareWand(
    () => buildShareUrl(window.location.origin, def.kind, item),
    copy,
  )
  const name = item.name ?? def.name(item.params)

  return (
    <li className={styles.slot} data-open={open} style={boxStyle(shelf, item)}>
      <button
        type="button"
        className={styles.box}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setMode('actions')
        }}
      >
        {def.kind === 'sword' && (
          <SwordOutline className={styles.outline} params={item.params} align="xMaxYMid" />
        )}
        <span className={styles.label}>
          <span className={styles.nameRow}>
            <span className={styles.name} data-name>
              {name}
            </span>
            <span className={styles.number}>No. {def.number(item.params)}</span>
          </span>
          <span className={styles.meta} data-line>
            {def.shelfLine(item.params)}
          </span>
        </span>
        <span className={styles.seal} aria-hidden="true" />
      </button>
      {open && mode === 'actions' && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              dispatch({ type: 'load', item })
              void navigate({ to: shelf.to })
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

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function ShelfRows({
  shelf,
  items,
  last,
}: {
  shelf: Shelf | null
  items: readonly StoredItem[]
  last: boolean
}) {
  const rows: { item: StoredItem; index: number }[][] = []
  items.forEach((item, index) => {
    if (index % PER_SHELF === 0) rows.push([])
    rows[rows.length - 1]!.push({ item, index })
  })
  const roomOnLastShelf = rows.length === 0 || rows[rows.length - 1]!.length < PER_SHELF
  if (last && !roomOnLastShelf) rows.push([])

  return rows.map((row, r) => (
    <div key={r} className={styles.shelf}>
      <ul className={styles.boxes}>
        {shelf &&
          row.map(({ item, index }) => (
            <ShelfBox
              key={`${index}-${shelf.view.item.number(item.params)}-${item.name ?? ''}`}
              shelf={shelf}
              item={item}
              index={index}
            />
          ))}
        {last && r === rows.length - 1 && (
          <li className={styles.empty}>
            {items.length === 0 ? 'Keep a wand and its box goes here' : 'Room for the next one'}
          </li>
        )}
      </ul>
    </div>
  ))
}

export function ShelfPage() {
  const benches = { wand: useWorkbench('wand'), sword: useWorkbench('sword') }
  const kept = (kind: ItemKind) => benches[kind].shelf
  const sections = SHELVES.filter((s) => kept(s.view.item.kind).length > 0)
  const wands = kept('wand').length
  const swords = kept('sword').length
  const count =
    swords === 0
      ? counted(wands, 'wand', 'wands')
      : [
          ...(wands > 0 ? [counted(wands, 'wand', 'wands')] : []),
          counted(swords, 'sword', 'swords'),
        ].join(', ')

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
        <span className={styles.count}>{count}</span>
      </header>
      <p className={styles.intro}>
        {swords === 0
          ? 'Every wand you keep gets a box and a label.'
          : 'Everything you keep gets a box and a label.'}
      </p>

      <div className={styles.sections}>
        {sections.length === 0 ? (
          <div className={styles.shelves}>
            <ShelfRows shelf={null} items={[]} last />
          </div>
        ) : (
          sections.map((shelf, i) => (
            <section key={shelf.heading} className={styles.shelves} aria-label={shelf.heading}>
              {sections.length > 1 && <h2 className={styles.heading}>{shelf.heading}</h2>}
              <ShelfRows
                shelf={shelf}
                items={kept(shelf.view.item.kind)}
                last={i === sections.length - 1}
              />
            </section>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <Link to="/" className={styles.counterButton}>
          Back to the counter
        </Link>
      </footer>
    </div>
  )
}
