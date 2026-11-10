import { useQuery } from '@tanstack/react-query'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { sharedLink } from '../../features/account/returnTo.ts'
import { useColourTheme } from '../useColourTheme.ts'

import styles from './AccountPage.module.scss'
import { SignedInPanel } from './SignedInPanel.tsx'
import { SignedOutCard } from './SignedOutCard.tsx'

/**
 * Hub owns the account UI for the whole estate (spec §6). It talks to the
 * family service browser-direct; hub's own backend knows nothing about it.
 */
export function AccountPage() {
  const [theme, setTheme] = useColourTheme()
  const client = useFamilyClient()
  const me = useQuery({ queryKey: familyQueryKeys.me, queryFn: () => client.me() })
  const shared = sharedLink()

  return (
    <main className={styles.account} data-theme={theme} data-account>
      <div className={styles.column}>
        <div className={styles.top}>
          <a className={styles.back} href="/">
            home of ed
          </a>
          <button
            type="button"
            className={styles.toggle}
            aria-label="Toggle light/dark theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            <span className={theme === 'dark' ? styles.sun : styles.moon} aria-hidden="true" />
          </button>
        </div>

        <h1 className={styles.title}>Account</h1>

        {me.isPending && <p className={styles.lede}>Loading your family…</p>}
        {me.isError && <p className={styles.error}>{accountErrorMessage(me.error, SERVICE_DOWN)}</p>}
        {me.data &&
          (me.data.parent === null ? (
            <>
              <p className={styles.lede}>
                Sign in to add child profiles and choose who is playing on this device.
              </p>
              <SignedOutCard />
            </>
          ) : (
            <SignedInPanel parent={me.data.parent} />
          ))}
        {/* /shared needs no account, so it stays reachable while family loads or is down. */}
        {shared !== null && !me.data?.parent && (
          <a className={styles.quiet} href={shared}>
            Open what was shared
          </a>
        )}
      </div>
    </main>
  )
}
