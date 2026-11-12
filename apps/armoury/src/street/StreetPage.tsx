import { Link } from '@tanstack/react-router'
import { type FocusEvent, useLayoutEffect, useRef } from 'react'

import { hubUrl } from '../useMediaQuery.ts'
import { DOOR_LABELS, openShopsCentreX, SHOPS, STREET_PAINTING } from './shops.ts'
import styles from './StreetPage.module.scss'

const { src, width, height } = STREET_PAINTING

// The browser leaves a half-visible link where it is; a keyboard visitor sees the whole shop.
function showWhole(event: FocusEvent<Element>) {
  if (event.currentTarget.matches(':focus-visible')) {
    event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

export function StreetPage() {
  const street = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const view = street.current
    if (!view || view.scrollWidth <= view.clientWidth) return
    view.scrollLeft = (openShopsCentreX() / width) * view.scrollWidth - view.clientWidth / 2
  }, [])

  return (
    <div className={styles.street}>
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
          preserveAspectRatio="xMidYMid slice"
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
              <path
                key={shop.id}
                className={styles.shut}
                d={shop.outline}
                data-shut={shop.id}
                aria-hidden="true"
              />
            ),
          )}
        </svg>
      </nav>
    </div>
  )
}
