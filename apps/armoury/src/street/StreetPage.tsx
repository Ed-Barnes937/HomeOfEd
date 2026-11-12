import { Link } from '@tanstack/react-router'
import {
  type CSSProperties,
  type FocusEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { SHOP_PATHS } from '../landing.ts'
import { hubUrl, REDUCED_MOTION_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { useShops } from '../workbench/WorkbenchProvider.tsx'
import { DOOR_LABELS, openingLeft, SHOPS, STREET_PAINTING } from './shops.ts'
import styles from './StreetPage.module.scss'

const { src, width, height } = STREET_PAINTING

type Side = 'left' | 'right'

// The browser leaves a half-visible link where it is; a keyboard visitor sees the whole shop.
function showWhole(event: FocusEvent<Element>) {
  if (event.currentTarget.matches(':focus-visible')) {
    event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

/** Which ways the street carries on past the edges of the view. */
function useMoreStreet(street: RefObject<HTMLElement | null>): Record<Side, boolean> {
  const [more, setMore] = useState({ left: false, right: false })
  useEffect(() => {
    const view = street.current
    if (!view) return
    const measure = () => {
      const left = view.scrollLeft > 1
      const right = view.scrollLeft + view.clientWidth < view.scrollWidth - 1
      setMore((was) => (was.left === left && was.right === right ? was : { left, right }))
    }
    measure()
    view.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      view.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [street])
  return more
}

export function StreetPage() {
  const street = useRef<HTMLElement>(null)
  const { lastShop } = useShops()
  const more = useMoreStreet(street)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)

  useLayoutEffect(() => {
    const view = street.current
    const shop = SHOPS.find((s) => s.to === SHOP_PATHS[lastShop ?? 'wand'])
    if (!view || !shop || view.scrollWidth <= view.clientWidth) return
    const scale = view.scrollWidth / width
    view.scrollLeft = openingLeft(shop, view.clientWidth / scale) * scale
  }, [lastShop])

  const walk = (side: Side) => {
    const view = street.current
    view?.scrollBy({
      left: (side === 'left' ? -0.8 : 0.8) * view.clientWidth,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
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
      {(['left', 'right'] as const).map(
        (side) =>
          more[side] && (
            <button
              key={side}
              type="button"
              className={`${styles.more} ${styles[side]}`}
              aria-label={`More street to the ${side}`}
              onClick={() => walk(side)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={side === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} />
              </svg>
            </button>
          ),
      )}
    </div>
  )
}
