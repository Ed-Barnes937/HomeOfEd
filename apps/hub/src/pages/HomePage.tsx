import { useQuery } from '@tanstack/react-query'

import { healthQueryOptions } from '../features/health/healthQuery.ts'
import styles from './HomePage.module.scss'

export function HomePage() {
  const health = useQuery(healthQueryOptions)
  const status = health.isPending ? 'pending' : health.isError ? 'error' : 'ok'
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <h1>home of ed</h1>
        <p className={styles.tagline}>independent little apps, one roof.</p>
      </section>
      <footer className={styles.status}>
        <span className={styles.dot} data-status={status} aria-hidden="true" />
        <span data-testid="health-value">
          {health.isPending
            ? 'checking…'
            : health.isError
              ? 'health check failed'
              : health.data.value}
        </span>
      </footer>
    </main>
  )
}
