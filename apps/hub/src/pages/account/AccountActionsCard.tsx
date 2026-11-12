import type { FamilyTokenClaims } from '@hoe/accounts'
import { clearFamilySession } from '@hoe/accounts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { familySessionCookieOptions } from '../../features/account/familyService.ts'
import { forgetProfile } from '../../features/account/silentRenewal.ts'

import styles from './AccountPage.module.scss'

export interface AccountActionsCardProps {
  onSessionChange: (session: FamilyTokenClaims | null) => void
}

export function AccountActionsCard({ onSessionChange }: AccountActionsCardProps) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  // Signing out drops both credentials: Better Auth's cookie session, and the
  // family token this device was playing with.
  const signOut = useMutation({ mutationFn: () => client.signOut(), onSuccess: nowSignedOut })

  const erase = useMutation({ mutationFn: () => client.deleteAccount(), onSuccess: nowSignedOut })

  /**
   * The caches are written rather than invalidated or removed. Either of those
   * refetches a query the signed-in panel is still observing for the tick before
   * it unmounts, which answers 401; and leaving the old list in place would show
   * one household's names to the next parent who signs in on the device.
   */
  function nowSignedOut(): void {
    clearFamilySession(familySessionCookieOptions(window.location.hostname))
    forgetProfile()
    onSessionChange(null)
    queryClient.setQueryData(familyQueryKeys.children, [])
    queryClient.setQueryData(familyQueryKeys.saveSummary, [])
    queryClient.setQueryData(familyQueryKeys.me, { parent: null })
  }

  return (
    <section className={styles.card} aria-labelledby="account-actions">
      <h2 className={styles.cardTitle} id="account-actions">
        This account
      </h2>
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          type="button"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          Sign out
        </button>
        {!confirming && (
          <button className={styles.danger} type="button" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        )}
      </div>
      {signOut.isError && (
        <p className={styles.error}>{accountErrorMessage(signOut.error, SERVICE_DOWN)}</p>
      )}
      {confirming && (
        <>
          <p className={styles.note}>
            This erases the account, every child profile on it, and everything the apps have saved
            to it. It cannot be undone.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.danger}
              type="button"
              disabled={erase.isPending}
              onClick={() => erase.mutate()}
            >
              Yes, delete everything
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setConfirming(false)}
            >
              Keep my account
            </button>
          </div>
          {erase.isError && (
            <p className={styles.error}>{accountErrorMessage(erase.error, SERVICE_DOWN)}</p>
          )}
        </>
      )}
    </section>
  )
}
