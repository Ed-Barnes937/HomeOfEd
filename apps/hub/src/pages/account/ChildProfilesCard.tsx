import type { ChildProfileView, FamilyTokenClaims } from '@hoe/accounts'
import { clearFamilySession } from '@hoe/accounts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { familySessionCookieOptions } from '../../features/account/familyService.ts'

import styles from './AccountPage.module.scss'
import { submitting } from './submitting.ts'

/**
 * The contract's own bound, enforced in the browser too. Past it the service
 * answers a tRPC parser failure whose message is a stringified zod issue array,
 * and a 33-character nickname is a plausible first thing to type here.
 */
const NAME_MAX_LENGTH = 32

export interface ChildProfilesCardProps {
  profiles: readonly ChildProfileView[]
  session: FamilyTokenClaims | null
  onSessionChange: (session: FamilyTokenClaims | null) => void
}

type RowMode = { id: string; kind: 'edit' | 'delete' } | null

export function ChildProfilesCard({ profiles, session, onSessionChange }: ChildProfilesCardProps) {
  const [mode, setMode] = useState<RowMode>(null)

  // A token for a deleted profile would keep this device saving to it.
  function forgetIfPlaying(profile: ChildProfileView): void {
    if (session?.sub !== profile.id) return
    clearFamilySession(familySessionCookieOptions(window.location.hostname))
    onSessionChange(null)
  }

  return (
    <section className={styles.card} aria-labelledby="child-profiles">
      <h2 className={styles.cardTitle} id="child-profiles">
        Child profiles
      </h2>
      {profiles.length === 0 ? (
        <p className={styles.note}>No profiles yet. Add one below.</p>
      ) : (
        <ul className={styles.list}>
          {profiles.map((profile) => {
            const rowMode = mode?.id === profile.id ? mode.kind : null
            return (
              <li className={styles.row} key={profile.id}>
                {rowMode === 'edit' ? (
                  <EditForm profile={profile} onDone={() => setMode(null)} />
                ) : rowMode === 'delete' ? (
                  <DeleteConfirm
                    profile={profile}
                    onDeleted={() => forgetIfPlaying(profile)}
                    onDone={() => setMode(null)}
                  />
                ) : (
                  <>
                    <span>
                      <span className={styles.rowName}>{profile.displayName}</span>{' '}
                      <span className={styles.rowHandle}>@{profile.username}</span>
                    </span>
                    <span className={styles.actions}>
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={() => setMode({ id: profile.id, kind: 'edit' })}
                      >
                        {`Edit ${profile.displayName}`}
                      </button>
                      <button
                        className={styles.danger}
                        type="button"
                        onClick={() => setMode({ id: profile.id, kind: 'delete' })}
                      >
                        {`Delete ${profile.displayName}`}
                      </button>
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <AddProfileForm />
    </section>
  )
}

function EditForm({ profile, onDone }: { profile: ChildProfileView; onDone: () => void }) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [username, setUsername] = useState(profile.username)

  const edit = useMutation({
    mutationFn: () => client.renameChild({ id: profile.id, displayName, username }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: familyQueryKeys.children })
      onDone()
    },
  })

  return (
    <form className={styles.field} onSubmit={submitting(() => edit.mutate())}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`display-name-${profile.id}`}>
          New display name
        </label>
        <input
          className={styles.input}
          id={`display-name-${profile.id}`}
          maxLength={NAME_MAX_LENGTH}
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`username-${profile.id}`}>
          New username
        </label>
        <input
          className={styles.input}
          id={`username-${profile.id}`}
          maxLength={NAME_MAX_LENGTH}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      {edit.isError && (
        <p className={styles.error}>{accountErrorMessage(edit.error, SERVICE_DOWN)}</p>
      )}
      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="submit"
          disabled={edit.isPending || displayName.trim() === '' || username.trim() === ''}
        >
          Save changes
        </button>
        <button className={styles.secondary} type="button" onClick={onDone}>
          Cancel changes
        </button>
      </div>
    </form>
  )
}

function DeleteConfirm({
  profile,
  onDeleted,
  onDone,
}: {
  profile: ChildProfileView
  onDeleted: () => void
  onDone: () => void
}) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()

  const erase = useMutation({
    mutationFn: () => client.deleteChild({ id: profile.id }),
    onSuccess: async () => {
      onDeleted()
      await queryClient.invalidateQueries({ queryKey: familyQueryKeys.children })
      onDone()
    },
  })

  return (
    <div className={styles.field}>
      <p className={styles.note}>
        {`This removes ${profile.displayName}'s profile and everything the apps have saved for it. It cannot be undone.`}
      </p>
      <div className={styles.actions}>
        <button
          className={styles.danger}
          type="button"
          disabled={erase.isPending}
          onClick={() => erase.mutate()}
        >
          {`Yes, delete ${profile.displayName}`}
        </button>
        <button className={styles.secondary} type="button" onClick={onDone}>
          {`Keep ${profile.displayName}`}
        </button>
      </div>
      {erase.isError && (
        <p className={styles.error}>{accountErrorMessage(erase.error, SERVICE_DOWN)}</p>
      )}
    </div>
  )
}

function AddProfileForm() {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')

  const add = useMutation({
    mutationFn: () => client.addChild({ username, displayName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: familyQueryKeys.children })
      setUsername('')
      setDisplayName('')
    },
  })

  return (
    <form className={styles.card} onSubmit={submitting(() => add.mutate())}>
      <h3 className={styles.cardTitle}>Add a profile</h3>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-display-name">
          Display name
        </label>
        <input
          className={styles.input}
          id="add-display-name"
          maxLength={NAME_MAX_LENGTH}
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-username">
          Username
        </label>
        <input
          className={styles.input}
          id="add-username"
          maxLength={NAME_MAX_LENGTH}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      {/* A taken username is a typed CONFLICT whose message is written for a
          person to read, so it lands here rather than as a crash. */}
      {add.isError && (
        <p className={styles.error}>{accountErrorMessage(add.error, SERVICE_DOWN)}</p>
      )}
      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="submit"
          disabled={add.isPending || displayName.trim() === '' || username.trim() === ''}
        >
          Add profile
        </button>
      </div>
    </form>
  )
}
