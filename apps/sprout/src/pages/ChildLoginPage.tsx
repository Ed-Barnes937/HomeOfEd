// Ported from the source `routes/child/login.tsx`. The device-login /
// PIN / password flows now go through the childAuth tRPC procedures, which
// throw typed errors (surfaced via `.message`) instead of returning `{ error }`
// and return `{ child, token }` on success. P4 stores the child PROFILE in
// localStorage; the signed token is set as the child-session cookie by the
// server in P5 (so subsequent child-scoped tRPC calls only authenticate once
// that transport lands — flagged).
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { Label } from '../components/ui/label.tsx'
import {
  changePassword,
  deviceChildrenQueryOptions,
  loginWithPassword,
  loginWithPin,
} from '../features/childAuth/childAuth.ts'
import { setChildSession, setChildSessionCookie } from '../lib/childSession.ts'
import { generateDeviceToken, getDeviceToken, setDeviceToken } from '../lib/deviceToken.ts'
import styles from './ChildLoginPage.module.scss'

interface ChildProfile {
  id: string
  displayName: string
  presetName: string
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

export function ChildLoginPage() {
  const navigate = useNavigate()
  const [deviceToken, setDeviceTokenState] = useState<string | null>(() => getDeviceToken())
  const [modeOverride, setModeOverride] = useState<'pin' | 'password' | null>(null)
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null)

  const [pin, setPin] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [pendingChange, setPendingChange] = useState<{
    childId: string
    password?: string
    pin?: string
    // The device token (for setDeviceToken after the change).
    token?: string
    // The signed child-session token from the initial login — still valid after
    // a password change (it carries no password), so we set the cookie with it
    // once onboarding completes.
    childToken?: string
  } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: deviceResult, isLoading: loadingProfiles } = useQuery({
    ...deviceChildrenQueryOptions(deviceToken ?? ''),
    enabled: Boolean(deviceToken),
  })
  const profiles = (deviceResult?.children ?? []) as ChildProfile[]

  const mode: 'profiles' | 'pin' | 'password' = modeOverride
    ? modeOverride
    : !deviceToken || (!loadingProfiles && profiles.length === 0)
      ? 'password'
      : 'profiles'

  const handleSelectChild = (child: ChildProfile) => {
    setSelectedChild(child)
    setPin('')
    setError('')
    setModeOverride('pin')
  }

  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedChild || !deviceToken) return
    setError('')
    setLoading(true)
    void (async () => {
      try {
        const result = await loginWithPin({ childId: selectedChild.id, pin, deviceToken })
        if (result.child.mustChangePassword) {
          setPendingChange({ childId: result.child.id, pin, childToken: result.token })
          setLoading(false)
          return
        }
        setChildSessionCookie(result.token)
        setChildSession(result.child)
        void navigate({ to: '/child/home' })
      } catch (err) {
        setError(errorMessage(err))
        setLoading(false)
      }
    })()
  }

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const token = deviceToken ?? generateDeviceToken()
    void (async () => {
      try {
        const result = await loginWithPassword({ username, password, deviceToken: token })
        if (result.child.mustChangePassword) {
          setPendingChange({ childId: result.child.id, password, token, childToken: result.token })
          setLoading(false)
          return
        }
        setDeviceToken(token)
        setDeviceTokenState(token)
        setChildSessionCookie(result.token)
        setChildSession(result.child)
        void navigate({ to: '/child/home' })
      } catch (err) {
        setError(errorMessage(err))
        setLoading(false)
      }
    })()
  }

  const handleChangePasswordSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!pendingChange) return
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    void (async () => {
      try {
        const result = await changePassword({
          childId: pendingChange.childId,
          newPassword,
          password: pendingChange.password,
          pin: pendingChange.pin,
        })
        if (pendingChange.token) {
          setDeviceToken(pendingChange.token)
          setDeviceTokenState(pendingChange.token)
        }
        // The initial-login token is still valid after the password change.
        if (pendingChange.childToken) setChildSessionCookie(pendingChange.childToken)
        setChildSession(result.child)
        void navigate({ to: '/child/home' })
      } catch (err) {
        setError(errorMessage(err))
        setLoading(false)
      }
    })()
  }

  if (pendingChange) {
    return (
      <div className={styles.centerPage}>
        <Card className={styles.cardSm}>
          <CardHeader className={styles.headerCenter}>
            <CardTitle className={styles.title}>Set a new password</CardTitle>
            <CardDescription>Pick a new password before you start.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePasswordSubmit} className={styles.form}>
              <div className={styles.field}>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className={styles.field}>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className={styles.errorText}>{error}</p>}
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? 'Saving...' : 'Save and continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loadingProfiles) {
    return (
      <div className={styles.loading}>
        <p className={styles.mutedText}>Loading...</p>
      </div>
    )
  }

  if (mode === 'profiles' && profiles.length > 0) {
    return (
      <div className={styles.centerPage}>
        <Card className={styles.cardMd}>
          <CardHeader className={styles.headerCenter}>
            <CardTitle className={styles.title}>Welcome back!</CardTitle>
            <CardDescription>Pick your name to get started.</CardDescription>
          </CardHeader>
          <CardContent className={styles.contentStack}>
            {profiles.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelectChild(child)}
                className={styles.profileButton}
              >
                <p className={styles.profileName}>{child.displayName}</p>
                <p className={styles.profilePreset}>
                  {child.presetName.replace(/-/g, ' ')}
                </p>
              </button>
            ))}
            <div className={styles.altWrap}>
              <button
                onClick={() => setModeOverride('password')}
                className={styles.linkButton}
              >
                Log in with username instead
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (mode === 'pin' && selectedChild) {
    return (
      <div className={styles.centerPage}>
        <Card className={styles.cardSm}>
          <CardHeader className={styles.headerCenter}>
            <CardTitle className={styles.title}>Hi, {selectedChild.displayName}!</CardTitle>
            <CardDescription>Enter your PIN.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className={styles.form}>
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={styles.pinInput}
                autoFocus
                required
              />
              {error && <p className={styles.errorTextCenter}>{error}</p>}
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? 'Checking...' : 'Go'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setModeOverride(null)
                  setError('')
                }}
                className={styles.linkButton}
              >
                Not you? Pick a different name
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.centerPage}>
      <Card className={styles.cardMd}>
        <CardHeader className={styles.headerCenter}>
          <CardTitle className={styles.title}>Log in</CardTitle>
          <CardDescription>Enter your username and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.field}>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className={styles.errorText}>{error}</p>}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
            <p className={styles.footerText}>
              <Link to="/" className={styles.primaryLink}>
                Back to home
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
