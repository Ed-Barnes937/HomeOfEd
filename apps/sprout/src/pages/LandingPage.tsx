// Ported from the source `routes/index.tsx`. Styled via SCSS module (P7b).
import { Link } from '@tanstack/react-router'

import { buttonVariants } from '../components/ui/button.tsx'
import { hubUrl } from '../hubUrl.ts'
import styles from './LandingPage.module.scss'

export function LandingPage() {
  return (
    <div className={styles.page}>
      <a
        className={styles.back}
        href={hubUrl(window.location.hostname)}
        aria-label="Back to home of ed"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>
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
