import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { hubUrl } from '../useMediaQuery.ts'
import { SmithyFront } from './SmithyFront.tsx'
import styles from './StreetPage.module.scss'
import { WandShopFront } from './WandShopFront.tsx'

function Door({
  to,
  label,
  shop,
  children,
}: {
  to: '/wands' | '/swords'
  label: string
  shop: 'wands' | 'smithy'
  children: ReactNode
}) {
  return (
    <Link to={to} className={styles.front} data-shop={shop} aria-label={label}>
      <span className={styles.spill} aria-hidden="true" />
      {children}
      <span className={styles.plaque} aria-hidden="true">
        {label}
      </span>
    </Link>
  )
}

export function StreetPage() {
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
        <p className={styles.motto}>Pick a door</p>
      </header>
      <div className={styles.sky} aria-hidden="true" />
      <nav className={styles.fronts} aria-label="Shops">
        <Door to="/wands" label="Go into the wand shop" shop="wands">
          <WandShopFront />
        </Door>
        <span className={styles.lamp} aria-hidden="true" />
        <Door to="/swords" label="Go into the smithy" shop="smithy">
          <SmithyFront />
        </Door>
      </nav>
    </div>
  )
}
