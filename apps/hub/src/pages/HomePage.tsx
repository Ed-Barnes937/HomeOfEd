import { useQuery } from '@tanstack/react-query'

import { healthQueryOptions } from '../features/health/healthQuery'
import styles from './HomePage.module.scss'

export function HomePage() {
  const health = useQuery(healthQueryOptions)
  return (
    <main className={styles.home}>
      <h1>home of ed</h1>
      <p className={styles.health} data-testid="health-value">
        {health.isPending ? 'checking…' : health.isError ? 'health check failed' : health.data.value}
      </p>
    </main>
  )
}
