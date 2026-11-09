import type { ChildProfileView } from '@hoe/accounts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { accountErrorMessage } from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'

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
}

export function ChildProfilesCard({ profiles }: ChildProfilesCardProps) {
  const [renaming, setRenaming] = useState<string | null>(null)

  return (
    <section className={styles.card} aria-labelledby="child-profiles">
      <h2 className={styles.cardTitle} id="child-profiles">
        Child profiles
      </h2>
      {profiles.length === 0 ? (
        <p className={styles.note}>No profiles yet. Add one below.</p>
      ) : (
        <ul className={styles.list}>
          {profiles.map((profile) => (
            <li className={styles.row} key={profile.id}>
              {renaming === profile.id ? (
                <RenameForm profile={profile} onDone={() => setRenaming(null)} />
              ) : (
                <>
                  <span>
                    <span className={styles.rowName}>{profile.displayName}</span>{' '}
                    <span className={styles.rowHandle}>@{profile.username}</span>
                  </span>
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={() => setRenaming(profile.id)}
                  >
                    {`Rename ${profile.displayName}`}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <AddProfileForm />
    </section>
  )
}

function RenameForm({ profile, onDone }: { profile: ChildProfileView; onDone: () => void }) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(profile.displayName)

  const rename = useMutation({
    mutationFn: () => client.renameChild({ id: profile.id, displayName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: familyQueryKeys.children })
      onDone()
    },
  })

  return (
    <form className={styles.field} onSubmit={submitting(() => rename.mutate())}>
      <label className={styles.label} htmlFor={`rename-${profile.id}`}>
        New display name
      </label>
      <input
        className={styles.input}
        id={`rename-${profile.id}`}
        maxLength={NAME_MAX_LENGTH}
        required
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {rename.isError && (
        <p className={styles.error}>{accountErrorMessage(rename.error, SERVICE_DOWN)}</p>
      )}
      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="submit"
          disabled={rename.isPending || displayName.trim() === ''}
        >
          Save name
        </button>
        <button className={styles.secondary} type="button" onClick={onDone}>
          Cancel rename
        </button>
      </div>
    </form>
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
      {add.isError && <p className={styles.error}>{accountErrorMessage(add.error, SERVICE_DOWN)}</p>}
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
