import { Link, useSearch } from '@tanstack/react-router'

import { ArrowLeftIcon } from '../components/icons.tsx'
import { WOTDCard } from '../components/WOTDCard.tsx'
import styles from './WotdPage.module.scss'

export function WotdPage() {
  const { level } = useSearch({ from: '/wotd' })
  return (
    <main className={styles.wotd} data-testid="wotd-page">
      <div className={styles.inner}>
        <Link to="/" className={styles.back} data-testid="wotd-back">
          <ArrowLeftIcon size={18} />
          Back to levels
        </Link>
        <WOTDCard level={level} />
      </div>
    </main>
  )
}
