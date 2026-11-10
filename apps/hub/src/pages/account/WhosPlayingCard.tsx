import type { ChildProfileView, FamilyTokenClaims, IdentityMeOutput } from '@hoe/accounts'
import { writeFamilySession } from '@hoe/accounts'
import { useMutation } from '@tanstack/react-query'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { familySessionCookieOptions } from '../../features/account/familyService.ts'

import styles from './AccountPage.module.scss'

type Parent = NonNullable<IdentityMeOutput['parent']>

export interface WhosPlayingCardProps {
  parent: Parent
  profiles: readonly ChildProfileView[]
  session: FamilyTokenClaims | null
  onSessionChange: (session: FamilyTokenClaims | null) => void
}

/**
 * Picking a profile mints the family token and stores it in the estate-wide
 * `hoe_family_session` cookie, which is the standing credential every app then
 * verifies offline. The cookie is written here, client-side, from the mint
 * reply - it is deliberately not httpOnly (ADR 0070, spec §4.4).
 */
export function WhosPlayingCard({
  parent,
  profiles,
  session,
  onSessionChange,
}: WhosPlayingCardProps) {
  const client = useFamilyClient()

  const pick = useMutation({
    mutationFn: async (childId: string | undefined) => {
      const { token } = await client.mintSessionToken(childId === undefined ? {} : { childId })
      return writeFamilySession(token, familySessionCookieOptions(window.location.hostname))
    },
    onSuccess: (claims) => onSessionChange(claims),
  })

  return (
    <section className={styles.card} aria-labelledby="whos-playing">
      <h2 className={styles.cardTitle} id="whos-playing">
        Who is playing on this device
      </h2>
      <p className={styles.note}>
        {session === null
          ? 'Nobody yet. Pick a profile and this device will save to it.'
          : `Playing now: ${session.name}`}
      </p>
      <div className={styles.pickers}>
        <Picker
          label={parent.name}
          pressed={session?.sub === parent.id}
          disabled={pick.isPending}
          onPick={() => pick.mutate(undefined)}
        />
        {profiles.map((child) => (
          <Picker
            key={child.id}
            label={child.displayName}
            pressed={session?.sub === child.id}
            disabled={pick.isPending}
            onPick={() => pick.mutate(child.id)}
          />
        ))}
      </div>
      {pick.isError && <p className={styles.error}>{accountErrorMessage(pick.error, SERVICE_DOWN)}</p>}
    </section>
  )
}

function Picker(props: {
  label: string
  pressed: boolean
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      className={styles.picker}
      type="button"
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onPick}
    >
      {props.label}
    </button>
  )
}
