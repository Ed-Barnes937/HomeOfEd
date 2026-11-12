import { Link, useNavigate } from '@tanstack/react-router'
import {
  type CSSProperties,
  type FocusEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { SHOP_PATHS } from '../landing.ts'
import { hubUrl, REDUCED_MOTION_QUERY, TOUCH_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { useShops } from '../workbench/WorkbenchProvider.tsx'
import {
  DOOR_LABELS,
  lightShapes,
  openingLeft,
  SHOPS,
  signposts,
  STREET_PAINTING,
  type StreetShop,
} from './shops.ts'
import styles from './StreetPage.module.scss'

const { src, dark, width, height } = STREET_PAINTING

const FLASH_MS = 1200
// In painting units: how far a shop's light reaches past its traced front, and how softly it ends.
const LIGHT_GROW = 24
const LIGHT_FEATHER = 16

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
  const navigate = useNavigate()
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const touch = useMediaQuery(TOUCH_QUERY)
  const [flashing, setFlashing] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [base, setBase] = useState<'loading' | 'dark' | 'lit'>('loading')
  const [litFailed, setLitFailed] = useState(false)
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
    if (touch) {
      setPicked(shop.id)
      return
    }
    setFlashing(shop.id)
    clearTimeout(flashEnds.current)
    flashEnds.current = setTimeout(() => setFlashing(null), FLASH_MS)
  }

  const pick = (shop: StreetShop) => {
    if (picked === shop.id && shop.to) void navigate({ to: shop.to })
    else setPicked(shop.id)
  }

  const pickedShop = touch ? SHOPS.find((shop) => shop.id === picked && shop.to) : undefined

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
          data-base={base}
          onClick={touch ? () => setPicked(null) : undefined}
        >
          <defs>
            <filter id="street-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation={width / 320} />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="street-feather" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={LIGHT_FEATHER} />
            </filter>
          </defs>
          <image
            href={base === 'lit' ? src : dark}
            width={width}
            height={height}
            aria-hidden="true"
            onLoad={() => setBase((was) => (was === 'loading' ? 'dark' : was))}
            onError={() => setBase('lit')}
          />
          {SHOPS.map(
            (shop) =>
              shop.to && (
                <g key={shop.id}>
                  <mask
                    id={`street-lights-${shop.id}`}
                    maskUnits="userSpaceOnUse"
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                  >
                    <g
                      filter="url(#street-feather)"
                      fill="#fff"
                      stroke="#fff"
                      strokeWidth={LIGHT_GROW * 2}
                      strokeLinejoin="round"
                    >
                      {lightShapes(shop).map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </g>
                  </mask>
                  {touch ? (
                    <g
                      role="button"
                      tabIndex={0}
                      className={styles.door}
                      aria-label={shop.name}
                      aria-pressed={picked === shop.id}
                      onFocus={showWhole}
                      onClick={(event) => {
                        event.stopPropagation()
                        pick(shop)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        pick(shop)
                      }}
                    >
                      <path className={styles.face} d={shop.outline} />
                    </g>
                  ) : (
                    <Link
                      to={shop.to}
                      className={styles.door}
                      data-flash={flashing === shop.id || undefined}
                      aria-label={DOOR_LABELS[shop.to]}
                      onFocus={showWhole}
                    >
                      <path className={styles.face} d={shop.outline} />
                    </Link>
                  )}
                  {!litFailed && (
                    <image
                      className={styles.lights}
                      href={src}
                      width={width}
                      height={height}
                      mask={`url(#street-lights-${shop.id})`}
                      data-lights={shop.id}
                      aria-hidden="true"
                      onError={() => setLitFailed(true)}
                    />
                  )}
                  <path className={styles.edge} d={shop.outline} filter="url(#street-glow)" />
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
            aria-current={pickedShop?.id === shop.id || undefined}
            onClick={() => show(shop)}
          >
            {shop.name}
          </button>
        ))}
      </div>
      <p className={styles.pointerHint}>Click a shop to go in.</p>
      <div className={styles.call} data-picked={pickedShop ? true : undefined}>
        <p className={styles.hint}>Slide along the street, then tap a shop.</p>
        <div className={styles.enterSlot} aria-live="polite">
          {pickedShop?.to && (
            <Link to={pickedShop.to} className={styles.enter}>
              Enter {pickedShop.name}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
