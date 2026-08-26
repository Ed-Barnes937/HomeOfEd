// Ported from the source `routes/parent/register.tsx`. Better Auth client
// (`/api/auth/*`) — prod mount is P5/D9 (flagged in features/parentAuth).
import { Link, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { Label } from '../components/ui/label.tsx'
import { parentAuth } from '../features/parentAuth/parentAuth.ts'
import { clearChildSession } from '../lib/childSession.ts'
import styles from './ParentRegisterPage.module.scss'

export function ParentRegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [ukResidenceAttested, setUkResidenceAttested] = useState(false)
  const [tosAgreed, setTosAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    void (async () => {
      const { error: signUpError } = await parentAuth.signUp({
        email,
        password,
        name,
        ukResidenceAttested,
        tosAgreed,
        inviteCode,
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      // One identity per browser: drop any co-resident child session so it
      // can't linger and reactivate when the parent later signs out.
      clearChildSession()
      void navigate({ to: '/parent/onboarding' })
    })()
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>Create your account</CardTitle>
          <CardDescription>Set up your parent account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

            <div className={styles.field}>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* ADR-0019 family pilot: the field is UX; the server-side
                sign-up hook is the control. */}
            <div className={styles.field}>
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </div>

            {/* ADR-0014 / ADR-0015: counsel-flagged copy — do not reword.
                The checkboxes are UX; the server-side before-create hook is
                the control. */}
            <div className={styles.checkboxField}>
              <input
                id="ukResidence"
                type="checkbox"
                checked={ukResidenceAttested}
                onChange={(e) => setUkResidenceAttested(e.target.checked)}
              />
              <Label htmlFor="ukResidence" className={styles.checkboxLabel}>
                I confirm I live in the United Kingdom
              </Label>
            </div>

            <div className={styles.checkboxField}>
              <input
                id="tosAgreed"
                type="checkbox"
                checked={tosAgreed}
                onChange={(e) => setTosAgreed(e.target.checked)}
              />
              <Label htmlFor="tosAgreed" className={styles.checkboxLabel}>
                I agree to the{' '}
                <a href="/terms" className={styles.link}>
                  Terms of Service
                </a>{' '}
                and have read the{' '}
                <a href="/privacy" className={styles.link}>
                  Privacy Policy
                </a>
              </Label>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" size="lg" disabled={loading || !ukResidenceAttested || !tosAgreed}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>

            <p className={styles.footer}>
              Already have an account?{' '}
              <Link to="/parent/login" className={styles.link}>
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
