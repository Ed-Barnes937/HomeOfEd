import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useMatch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import {
  FAMILY_STALE_MS,
  familyQueryKeys,
  SERVICE_DOWN,
} from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { sharedLink } from '../../features/account/returnTo.ts'
import { renewSilently, silentRenewalWorthTrying } from '../../features/account/silentRenewal.ts'
import { useColourTheme } from '../useColourTheme.ts'

import styles from './AccountPage.module.scss'
import { SettingsPanel } from './SettingsPanel.tsx'
import { SignedOutCard } from './SignedOutCard.tsx'
import { WhoIsPlaying } from './WhoIsPlaying.tsx'

/**
 * Hub owns the account UI for the whole estate (spec §6). It talks to the
 * family service browser-direct; hub's own backend knows nothing about it.
 * Signed in, `/account` is the "who is playing" picker and `/account/settings`
 * holds the rest, for grown-ups (ADR 0103).
 */
export function AccountPage() {
  const [theme, setTheme] = useColourTheme()
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const shared = sharedLink()
  const inSettings = useMatch({ from: '/account/settings', shouldThrow: false }) !== undefined
  const [renewing, setRenewing] = useState(() => !inSettings && silentRenewalWorthTrying())
  const me = useQuery({
    queryKey: familyQueryKeys.me,
    queryFn: () => client.me(),
    enabled: !renewing,
    staleTime: FAMILY_STALE_MS,
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

  const parent = me.data?.parent ?? null
  const picking = parent !== null && !inSettings

  return (
    <main className={styles.account} data-theme={theme} data-account>
      <div className={picking ? `${styles.column} ${styles.picking}` : styles.column}>
        <div className={styles.top}>
          {parent !== null && inSettings ? (
            // `search` carries the `returnTo` there and back (ADR 0103).
            <Link className={styles.back} to="/account" search={true}>
              <span aria-hidden="true">← </span>Who is playing
            </Link>
          ) : (
            <a className={styles.back} href="/">
              home of ed
            </a>
          )}
          <div className={styles.topActions}>
            {picking && (
              <Link
                className={styles.toggle}
                to="/account/settings"
                search={true}
                aria-label="Grown-up settings"
                title="Grown-up settings"
              >
                <CogIcon />
              </Link>
            )}
            <button
              type="button"
              className={styles.toggle}
              aria-label="Toggle light/dark theme"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              <span className={theme === 'dark' ? styles.sun : styles.moon} aria-hidden="true" />
            </button>
          </div>
        </div>

        <h1 className={styles.title}>
          {parent === null ? 'Account' : inSettings ? 'Settings' : 'Who is playing?'}
        </h1>

        {me.isPending && <p className={styles.lede}>Loading your family…</p>}
        {me.isError && (
          <p className={styles.error}>{accountErrorMessage(me.error, SERVICE_DOWN)}</p>
        )}
        {me.data && parent === null && (
          <>
            <p className={styles.lede}>
              Sign in to add child profiles and choose who is playing on this device.
            </p>
            <SignedOutCard />
          </>
        )}
        {parent !== null &&
          (inSettings ? <SettingsPanel parent={parent} /> : <WhoIsPlaying parent={parent} />)}
        {/* /shared needs no account, so it stays reachable while family loads or is down. */}
        {sharedItem}
      </div>
    </main>
  )
}

// Feather's "settings" icon (MIT).
function CogIcon() {
  return (
    <svg className={styles.cog} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
