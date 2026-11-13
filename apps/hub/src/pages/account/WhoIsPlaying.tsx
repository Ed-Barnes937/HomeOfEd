import type { IdentityMeOutput } from '@hoe/accounts'
import { profileInitial, readFamilySession, writeFamilySession } from '@hoe/accounts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type CSSProperties, useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import {
  FAMILY_STALE_MS,
  familyQueryKeys,
  SERVICE_DOWN,
} from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { familySessionCookieOptions } from '../../features/account/familyService.ts'
import { profileColour } from '../../features/account/profileColour.ts'
import { readsBack, returnToApp } from '../../features/account/returnTo.ts'
import { rememberProfile } from '../../features/account/silentRenewal.ts'

import styles from './AccountPage.module.scss'

type Parent = NonNullable<IdentityMeOutput['parent']>

interface Choice {
  id: string
  name: string
  childId: string | undefined
}

/**
 * Picking a profile mints the family token and stores it in the estate-wide
 * `hoe_family_session` cookie, which is the standing credential every app then
 * verifies offline. The cookie is written here, client-side, from the mint
 * reply - it is deliberately not httpOnly (ADR 0070, spec §4.4). Once it reads
 * back, the visitor goes to the app that sent them, or else hub home (ADR 0103).
 */
export function WhoIsPlaying({ parent }: { parent: Parent }) {
  const client = useFamilyClient()
  const navigate = useNavigate()
  const [playing, setPlaying] = useState(() => readFamilySession()?.sub ?? null)

  const children = useQuery({
    queryKey: familyQueryKeys.children,
    queryFn: () => client.listChildren(),
    staleTime: FAMILY_STALE_MS,
  })

  const pick = useMutation({
    mutationFn: async (childId: string | undefined) => {
      const { token } = await client.mintSessionToken(childId === undefined ? {} : { childId })
      return writeFamilySession(token, familySessionCookieOptions(window.location.hostname))
    },
    onSuccess: (claims) => {
      // Whatever the browser kept, so a dropped write never shows as a pick.
      setPlaying(readFamilySession()?.sub ?? null)
      if (!readsBack(claims)) return
      rememberProfile(claims.sub)
      if (!returnToApp(claims)) void navigate({ to: '/', replace: true })
    },
  })

  if (children.isError) {
    return <p className={styles.error}>{accountErrorMessage(children.error, SERVICE_DOWN)}</p>
  }
  if (!children.data) return null

  const choices: Choice[] = [
    { id: parent.id, name: parent.name, childId: undefined },
    ...children.data.map((child) => ({
      id: child.id,
      name: child.displayName,
      childId: child.id,
    })),
  ]

  return (
    <>
      <ul className={styles.profiles} aria-label="Profiles">
        {choices.map((choice, position) => (
          <li key={choice.id}>
            <button
              className={styles.profile}
              type="button"
              style={{ '--avatar': profileColour(position) } as CSSProperties}
              aria-pressed={playing === choice.id}
              disabled={pick.isPending}
              onClick={() => pick.mutate(choice.childId)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {profileInitial(choice.name)}
                {playing === choice.id && <PlayingMark />}
              </span>
              <span className={styles.profileName}>{choice.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {pick.isError && (
        <p className={styles.error}>{accountErrorMessage(pick.error, SERVICE_DOWN)}</p>
      )}
    </>
  )
}

function PlayingMark() {
  return (
    <svg className={styles.playingMark} viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="12" />
      <path d="M6.5 12.5l3.5 3.5 7.5-8" />
    </svg>
  )
}
