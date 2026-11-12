import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import {
  accountErrorMessage,
  isRateLimited,
  RATE_LIMIT_PAUSE_MS,
} from '../../features/account/accountError.ts'
import { familyQueryKeys, SERVICE_DOWN } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'

import styles from './AccountPage.module.scss'
import { submitting } from './submitting.ts'

/**
 * Sign in, or register behind the invite code. One form at a time, so the two
 * "Email" fields can never both be on the page.
 */
export function SignedOutCard() {
  const [registering, setRegistering] = useState(false)
  return registering ? (
    <RegisterForm onBack={() => setRegistering(false)} />
  ) : (
    <SignInForm onRegister={() => setRegistering(true)} />
  )
}

function SignInForm({ onRegister }: { onRegister: () => void }) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: () => client.signIn({ email, password }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: familyQueryKeys.all }),
  })
  const paused = usePauseAfterRateLimit(signIn.error)

  return (
    <form className={styles.card} onSubmit={submitting(() => signIn.mutate())}>
      <h2 className={styles.cardTitle}>Sign in</h2>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="signin-email">
          Email
        </label>
        <input
          className={styles.input}
          id="signin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="signin-password">
          Password
        </label>
        <input
          className={styles.input}
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {signIn.isError && (
        <p className={styles.error}>{accountErrorMessage(signIn.error, SERVICE_DOWN)}</p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={signIn.isPending || paused}>
          Sign in
        </button>
      </div>
      <button className={styles.quiet} type="button" onClick={onRegister}>
        Register with an invite code
      </button>
    </form>
  )
}

function RegisterForm({ onBack }: { onBack: () => void }) {
  const client = useFamilyClient()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const register = useMutation({
    mutationFn: () => client.signUp({ name, email, password, inviteCode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: familyQueryKeys.all }),
  })
  const paused = usePauseAfterRateLimit(register.error)

  return (
    <form className={styles.card} onSubmit={submitting(() => register.mutate())}>
      <h2 className={styles.cardTitle}>Create an account</h2>
      <p className={styles.note}>
        Registration is open to invited households only, so you will need the invite code.
      </p>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-name">
          Your name
        </label>
        <input
          className={styles.input}
          id="register-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-email">
          Email
        </label>
        <input
          className={styles.input}
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-password">
          Password
        </label>
        <input
          className={styles.input}
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-invite">
          Invite code
        </label>
        <input
          className={styles.input}
          id="register-invite"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      </div>
      {register.isError && (
        <p className={styles.error}>{accountErrorMessage(register.error, SERVICE_DOWN)}</p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={register.isPending || paused}>
          Create account
        </button>
      </div>
      <button className={styles.quiet} type="button" onClick={onBack}>
        Back to sign in
      </button>
    </form>
  )
}

/** True for a minute after a rate-limited try, so the form cannot be sent again meanwhile. */
function usePauseAfterRateLimit(error: unknown): boolean {
  const [expired, setExpired] = useState<unknown>(null)
  useEffect(() => {
    if (!isRateLimited(error)) return
    const timer = setTimeout(() => setExpired(error), RATE_LIMIT_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [error])
  return isRateLimited(error) && expired !== error
}
