import { useSearch } from '@tanstack/react-router'

import { WOTDCard } from '../components/WOTDCard.tsx'
import styles from './WotdPage.module.scss'

export function WotdPage() {
  const { level } = useSearch({ from: '/wotd' })
  return (
    <main className={styles.wotd} data-testid="wotd-page">
      <WOTDCard level={level} />
    </main>
  )
}
