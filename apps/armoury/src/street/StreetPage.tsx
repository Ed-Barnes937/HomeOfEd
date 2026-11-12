import { Link } from '@tanstack/react-router'
import {
  type CSSProperties,
  type FocusEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { SHOP_PATHS } from '../landing.ts'
import { hubUrl, REDUCED_MOTION_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { useShops } from '../workbench/WorkbenchProvider.tsx'
import {
  DOOR_LABELS,
  openingLeft,
  SHOPS,
  signposts,
  STREET_PAINTING,
  type StreetShop,
} from './shops.ts'
import styles from './StreetPage.module.scss'

const { src, width, height } = STREET_PAINTING

const FLASH_MS = 1200

// The browser leaves a half-visible link where it is; a keyboard visitor sees the whole shop.
function showWhole(event: FocusEvent<Element>) {
  if (event.currentTarget.matches(':focus-visible')) {
    event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

/** How far along the street `view` scrolls to show `shop`, or null when the whole street fits. */
function scrollFor(view: HTMLElement, shop: StreetShop): number | null {
  if (view.scrollWidth <= view.clientWidth) return null
  const scale = view.scrollWidth / width
  return openingLeft(shop, view.clientWidth / scale) * scale
}

export function StreetPage() {
  const street = useRef<HTMLElement>(null)
  const { lastShop } = useShops()
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const [flashing, setFlashing] = useState<string | null>(null)
  const flashEnds = useRef<ReturnType<typeof setTimeout>>(undefined)

  useLayoutEffect(() => {
    const view = street.current
    const shop = SHOPS.find((s) => s.to === SHOP_PATHS[lastShop ?? 'wand'])
    const left = view && shop ? scrollFor(view, shop) : null
    if (view && left !== null) view.scrollLeft = left
  }, [lastShop])

  useEffect(() => () => clearTimeout(flashEnds.current), [])

  const show = (shop: StreetShop) => {
    const view = street.current
    const left = view ? scrollFor(view, shop) : null
    if (view && left !== null) view.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' })
    setFlashing(shop.id)
    clearTimeout(flashEnds.current)
    flashEnds.current = setTimeout(() => setFlashing(null), FLASH_MS)
  }

  return (
    <div className={styles.street} style={{ '--ratio': width / height } as CSSProperties}>
      <header className={styles.header}>
        <a
          className={styles.hub}
          href={hubUrl(window.location.hostname)}
          aria-label="Back to home of ed"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 3 L5 8 L10 13" />
          </svg>
        </a>
        <h1 className={styles.title}>Armoury</h1>
        <p className={styles.motto}>Pick a shop</p>
      </header>
      <nav ref={street} className={styles.view} aria-label="Shops">
        <svg
          className={styles.painting}
          style={{ aspectRatio: `${width} / ${height}` }}
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <filter id="street-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation={width / 320} />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <image href={src} width={width} height={height} aria-hidden="true" />
          {SHOPS.map((shop) =>
            shop.to ? (
              <Link
                key={shop.id}
                to={shop.to}
                className={styles.door}
                data-flash={flashing === shop.id || undefined}
                aria-label={DOOR_LABELS[shop.to]}
                onFocus={showWhole}
              >
                <path className={styles.face} d={shop.outline} />
                <path className={styles.edge} d={shop.outline} filter="url(#street-glow)" />
              </Link>
            ) : (
              <g key={shop.id} className={styles.shut} data-shut={shop.id} aria-hidden="true">
                <path className={styles.drain} d={shop.outline} />
                <path className={styles.dusk} d={shop.outline} />
              </g>
            ),
          )}
        </svg>
      </nav>
      <div className={styles.signposts}>
        {signposts().map((shop) => (
          <button
            key={shop.id}
            type="button"
            className={styles.signpost}
            aria-label={`Show ${shop.name} on the street`}
            onClick={() => show(shop)}
          >
            {shop.name}
          </button>
        ))}
      </div>
      <p className={styles.hint}>Slide along the street, then tap a shop.</p>
    </div>
  )
}
