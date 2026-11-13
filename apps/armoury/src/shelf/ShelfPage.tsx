import { Link, useNavigate } from '@tanstack/react-router'
import { useId, useState, type CSSProperties } from 'react'

import { apothecary } from '../apothecary/apothecary.ts'
import { PotionOutline } from '../apothecary/PotionOutline.tsx'
import type { ItemKind, StoredItem } from '../items/item.ts'
import { buildShareUrl } from '../share/shareLink.ts'
import { useShareWand } from '../share/useShareWand.ts'
import type { ShopView } from '../shop/shopView.ts'
import { wandShop } from '../shop/wandShop.ts'
import { smithy } from '../smithy/smithy.ts'
import { SwordOutline } from '../smithy/SwordOutline.tsx'
import { useShops, useWorkbench } from '../workbench/WorkbenchProvider.tsx'
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
  /** One of it, and many, for the count in the header. */
  noun: readonly [string, string]
}

const SHELVES: readonly Shelf[] = [
  { view: wandShop, heading: 'Wands', noun: ['wand', 'wands'] },
  { view: smithy, heading: 'Swords', noun: ['sword', 'swords'] },
  { view: apothecary, heading: 'Potions', noun: ['potion', 'potions'] },
]

/** The way back and the empty shelf's words, by the shop the child was last in. */
const BACK: Record<ItemKind, { label: string; intro: string; empty: string }> = {
  wand: {
    label: 'Back to the counter',
    intro: 'Every wand you keep gets a box and a label.',
    empty: 'Keep a wand and its box goes here',
  },
  sword: {
    label: 'Back to the anvil',
    intro: 'Every sword you keep gets a box and a label.',
    empty: 'Keep a sword and its box goes here',
  },
  potion: {
    label: 'Back to the brewing table',
    intro: 'Every potion you keep gets a box and a label.',
    empty: 'Keep a potion and its box goes here',
  },
}

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
        {def.kind === 'potion' && <PotionOutline className={styles.bottle} params={item.params} />}
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
              void navigate({ to: shelf.view.path })
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
  empty,
}: {
  shelf: Shelf | null
  items: readonly StoredItem[]
  last: boolean
  empty: string
}) {
  const rows: { item: StoredItem; index: number }[][] = []
  items.forEach((item, index) => {
    if (index % PER_SHELF === 0) rows.push([])
    rows[rows.length - 1]!.push({ item, index })
  })
  const roomOnLastShelf = rows.length > 0 && rows[rows.length - 1]!.length < PER_SHELF
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
          <li className={styles.empty}>{items.length === 0 ? empty : 'Room for the next one'}</li>
        )}
      </ul>
    </div>
  ))
}

export function ShelfPage() {
  const benches = {
    wand: useWorkbench('wand'),
    sword: useWorkbench('sword'),
    potion: useWorkbench('potion'),
  }
  const lastShop = useShops().lastShop ?? 'wand'
  const back = BACK[lastShop]
  const backTo = SHELVES.find((s) => s.view.item.kind === lastShop)!.view.path
  const headingId = useId()
  const kept = (kind: ItemKind) => benches[kind].shelf
  const sections = SHELVES.filter((s) => kept(s.view.item.kind).length > 0)
  const count =
    sections.length === 0
      ? counted(0, ...SHELVES.find((s) => s.view.item.kind === lastShop)!.noun)
      : sections.map((s) => counted(kept(s.view.item.kind).length, ...s.noun)).join(', ')
  // A shelf of wands alone keeps the words it had before there were other shops.
  const intro =
    sections.length === 0
      ? back.intro
      : sections.length === 1 && sections[0]!.view.item.kind === 'wand'
        ? BACK.wand.intro
        : 'Everything you keep gets a box and a label.'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={backTo} className={styles.back} aria-label={back.label}>
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
      <p className={styles.intro}>{intro}</p>

      <div className={styles.sections}>
        {sections.length === 0 ? (
          <div className={styles.shelves}>
            <ShelfRows shelf={null} items={[]} last empty={back.empty} />
          </div>
        ) : (
          sections.map((shelf, i) => {
            const titled = sections.length > 1
            const kind = shelf.view.item.kind
            return (
              <section
                key={shelf.heading}
                className={styles.shelves}
                data-shelf={kind}
                aria-labelledby={titled ? `${headingId}-${kind}` : undefined}
              >
                {titled && (
                  <h2 id={`${headingId}-${kind}`} className={styles.heading}>
                    {shelf.heading}
                  </h2>
                )}
                <ShelfRows
                  shelf={shelf}
                  items={kept(kind)}
                  last={i === sections.length - 1}
                  empty={back.empty}
                />
              </section>
            )
          })
        )}
      </div>

      <footer className={styles.footer}>
        <Link to={backTo} className={styles.counterButton}>
          {back.label}
        </Link>
      </footer>
    </div>
  )
}
