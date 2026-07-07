// Ported from the source `routes/parent/settings.tsx`. Preferences are
// client-only (localStorage) — no tRPC surface. Gated via useRequireParent.
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { buttonVariants } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Label } from '../components/ui/label.tsx'
import { Switch } from '../components/ui/switch.tsx'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import styles from './SettingsPage.module.scss'

const NOTIFICATIONS_STORAGE_KEY = 'sprout-settings-notifications'
const THEME_STORAGE_KEY = 'sprout-settings-theme'

interface NotificationPreferences {
  flagNotifications: boolean
  sessionLimitNotifications: boolean
}

interface ThemePreferences {
  darkMode: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  flagNotifications: true,
  sessionLimitNotifications: true,
}

const DEFAULT_THEME: ThemePreferences = { darkMode: false }

function loadNotificationPrefs(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (stored) return { ...DEFAULT_NOTIFICATIONS, ...(JSON.parse(stored) as object) }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_NOTIFICATIONS
}

function loadThemePrefs(): ThemePreferences {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored) return { ...DEFAULT_THEME, ...(JSON.parse(stored) as object) }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_THEME
}

export function SettingsPage() {
  const session = useRequireParent()
  const [notifications, setNotifications] = useState<NotificationPreferences>(loadNotificationPrefs)
  const [theme, setTheme] = useState<ThemePreferences>(loadThemePrefs)

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
    document.documentElement.classList.toggle('dark', theme.darkMode)
  }, [theme])

  if (session.isPending) {
    return (
      <div className={styles.loading}>
        <p className={styles.mutedText}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  return (
    <div className={styles.page}>
      <Link to="/parent/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Back to dashboard
      </Link>

      <h1 className={styles.heading}>Settings</h1>
      <p className={styles.subtitle}>
        Manage your notification, display, and privacy preferences.
      </p>

      <div className={styles.sections}>
        <Card>
          <CardHeader>
            <CardTitle>Notification preferences</CardTitle>
            <CardDescription>Choose which notifications you receive.</CardDescription>
          </CardHeader>
          <CardContent className={styles.contentStack4}>
            <div className={styles.row}>
              <Label>Flag notifications</Label>
              <Switch
                aria-label="Flag notifications"
                checked={notifications.flagNotifications}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, flagNotifications: checked }))
                }
              />
            </div>
            <div className={styles.row}>
              <Label>Session limit notifications</Label>
              <Switch
                aria-label="Session limit notifications"
                checked={notifications.sessionLimitNotifications}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, sessionLimitNotifications: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display preferences</CardTitle>
            <CardDescription>Customise the app appearance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.row}>
              <Label>Dark mode</Label>
              <Switch
                aria-label="Dark mode"
                checked={theme.darkMode}
                onCheckedChange={(checked) => setTheme((prev) => ({ ...prev, darkMode: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legal</CardTitle>
          </CardHeader>
          <CardContent className={styles.contentStack2}>
            <a href="#" className={styles.legalLink} aria-label="Privacy Policy">
              Privacy Policy
            </a>
            <a href="#" className={styles.legalLink} aria-label="Terms of Service">
              Terms of Service
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
