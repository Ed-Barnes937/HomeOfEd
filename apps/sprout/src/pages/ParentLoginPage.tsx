// Ported from the source `routes/parent/login.tsx`. Parent auth goes through
// the Better Auth client (`/api/auth/*`) — the prod mount is P5/D9, so this
// round-trip is not exercisable end-to-end yet (flagged in features/parentAuth).
import { Link, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import { Label } from '../components/ui/label.tsx'
import { parentAuth } from '../features/parentAuth/parentAuth.ts'
import styles from './ParentLoginPage.module.scss'

export function ParentLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    void (async () => {
      const { error: signInError } = await parentAuth.signIn({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      void navigate({ to: '/parent/dashboard' })
    })()
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>Parent login</CardTitle>
          <CardDescription>Log in to manage your children&apos;s experience.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className={styles.form}>
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

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>

            <p className={styles.footer}>
              Don&apos;t have an account?{' '}
              <Link to="/parent/register" className={styles.link}>
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
