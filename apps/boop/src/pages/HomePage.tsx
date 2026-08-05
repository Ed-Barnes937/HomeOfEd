import { useQuery } from '@tanstack/react-query'

import '../styles/tokens.scss'
import { greetingQueryOptions } from '../features/greeting/greetingQuery.ts'
import styles from './HomePage.module.scss'

// Placeholder for the boop scaffold (ticket 11). The 6x16 step-sequencer grid,
// transport, and kit land in later tickets — this route only proves the
// layered path (tRPC → GreetingHandler → ctx.auth) and the styles scaffolding.
export function HomePage() {
  const greeting = useQuery(greetingQueryOptions)
  const status = greeting.isPending ? 'pending' : greeting.isError ? 'error' : 'ok'
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <h1>boop</h1>
        <p className={styles.tagline}>a 6x16 step-sequencer for kids. coming soon.</p>
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
