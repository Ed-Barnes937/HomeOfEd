// Ported from the source `routes/index.tsx`. Styled via SCSS module (P7b).
import { Link } from '@tanstack/react-router'

import { buttonVariants } from '../components/ui/button.tsx'
import styles from './LandingPage.module.scss'

export function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1 className={styles.title}>sprout</h1>
        <p className={styles.tagline}>
          A safe, parent-controlled AI chat experience for children.
        </p>
      </div>

      <div className={styles.actions}>
        <Link to="/parent/login" className={buttonVariants({ size: 'lg' })}>
          I&apos;m a parent
        </Link>
        <Link to="/child/login" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          I&apos;m a child
        </Link>
      </div>

      <p className={styles.footer}>
        New here?{' '}
        <Link to="/parent/register" className={styles.link}>
          Create an account
        </Link>
      </p>
    </div>
  )
}
