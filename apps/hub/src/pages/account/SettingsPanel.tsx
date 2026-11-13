import type { FamilyTokenClaims, IdentityMeOutput } from '@hoe/accounts'
import { readFamilySession } from '@hoe/accounts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import {
  FAMILY_STALE_MS,
  familyQueryKeys,
  SERVICE_DOWN,
} from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'

import { AccountActionsCard } from './AccountActionsCard.tsx'
import styles from './AccountPage.module.scss'
import { ChildProfilesCard } from './ChildProfilesCard.tsx'
import { LastSaved } from './LastSaved.tsx'

export interface SettingsPanelProps {
  parent: NonNullable<IdentityMeOutput['parent']>
}

/** Everything behind the picker's cog: for grown-ups, not for whoever is picking. */
export function SettingsPanel({ parent }: SettingsPanelProps) {
  const client = useFamilyClient()
  // The cookie is read imperatively, so the active profile is local state the
  // profile delete and the sign-out both update.
  const [session, setSession] = useState<FamilyTokenClaims | null>(() => readFamilySession())

  const children = useQuery({
    queryKey: familyQueryKeys.children,
    queryFn: () => client.listChildren(),
    staleTime: FAMILY_STALE_MS,
  })

  return (
    <>
      <div>
        <p className={styles.lede}>
          Signed in as {parent.name} ({parent.email})
        </p>
        <LastSaved accountId={parent.id} name={parent.name} />
      </div>
      {children.isError && (
        <p className={styles.error}>{accountErrorMessage(children.error, SERVICE_DOWN)}</p>
      )}
      {children.data && (
        <ChildProfilesCard
          profiles={children.data}
          session={session}
          onSessionChange={setSession}
        />
      )}
      <AccountActionsCard onSessionChange={setSession} />
    </>
  )
}
