import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { sharedLink } from '../../features/account/returnTo.ts'
import {
  handOffStaleTime,
  renewSilently,
  silentRenewalWorthTrying,
} from '../../features/account/silentRenewal.ts'
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
  const queryClient = useQueryClient()
  const shared = sharedLink()
  const [renewing, setRenewing] = useState(silentRenewalWorthTrying)
  const me = useQuery({
    queryKey: familyQueryKeys.me,
    queryFn: () => client.me(),
    enabled: !renewing,
    staleTime: handOffStaleTime,
  })

  useEffect(() => {
    if (!renewing) return
    void renewSilently(client, queryClient).then((returning) => {
      if (!returning) setRenewing(false)
    })
  }, [renewing, client, queryClient])

  const sharedItem = shared !== null && !me.data?.parent && (
    <a className={styles.quiet} href={shared}>
      Open what was shared
    </a>
  )

  // Silent renewal shows no screen, only the way to a shared item, which needs no account.
  if (renewing) {
    return (
      <main className={styles.account} data-theme={theme} data-account aria-busy>
        <div className={styles.column}>{sharedItem}</div>
      </main>
    )
  }

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
        {me.isError && (
          <p className={styles.error}>{accountErrorMessage(me.error, SERVICE_DOWN)}</p>
        )}
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
        {sharedItem}
      </div>
    </main>
  )
}
