import { useQuery } from '@tanstack/react-query'

import { greetingQueryOptions } from '../features/greeting/greetingQuery.ts'
import styles from './HomePage.module.scss'

export function HomePage() {
  const greeting = useQuery(greetingQueryOptions)
  const status = greeting.isPending ? 'pending' : greeting.isError ? 'error' : 'ok'
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <h1>starter</h1>
        <p className={styles.tagline}>a stateless app, ready to copy.</p>
      </section>
      <footer className={styles.status}>
        <span className={styles.dot} data-status={status} aria-hidden="true" />
        <span data-testid="greeting-value">
          {greeting.isPending
            ? 'loading…'
            : greeting.isError
              ? 'request failed'
              : greeting.data.value}
        </span>
      </footer>
    </main>
  )
}
