import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { FAMILY_INVITE_CODE, FIXTURE_PARENT } from './familyFixture.ts'

/**
 * The /account screens. Navigation is client-side (history + popstate, sprout's
 * precedent) so the mounted app and the installed trampoline stay live.
 */
export class AccountPagePom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await this.goto()
    await expect(this.page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  }

  async goto(): Promise<void> {
    await this.page.evaluate(() => {
      window.history.pushState({}, '', '/account')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  async verifyOffersSignIn(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(this.page.getByLabel('Email')).toBeVisible()
    await expect(this.page.getByLabel('Password')).toBeVisible()
  }

  async register(
    overrides: { email?: string; inviteCode?: string } = {},
  ): Promise<void> {
    await this.page.getByRole('button', { name: 'Register with an invite code' }).click()
    await this.page.getByLabel('Your name').fill(FIXTURE_PARENT.name)
    await this.page.getByLabel('Email').fill(overrides.email ?? 'newparent@example.com')
    await this.page.getByLabel('Password').fill(FIXTURE_PARENT.password)
    await this.page.getByLabel('Invite code').fill(overrides.inviteCode ?? FAMILY_INVITE_CODE)
    await this.page.getByRole('button', { name: 'Create account' }).click()
  }

  async signIn(): Promise<void> {
    await this.page.getByLabel('Email').fill(FIXTURE_PARENT.email)
    await this.page.getByLabel('Password').fill(FIXTURE_PARENT.password)
    await this.page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }

  async signInWithWrongPassword(): Promise<void> {
    await this.page.getByLabel('Email').fill(FIXTURE_PARENT.email)
    await this.page.getByLabel('Password').fill('not-the-password')
    await this.page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }

  async verifySignedInAs(name: string): Promise<void> {
    await expect(this.page.getByText(`Signed in as ${name}`)).toBeVisible()
  }

  async verifySignedOut(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(this.page.getByText('Signed in as')).toHaveCount(0)
  }

  async verifyInlineError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible()
  }

  async addProfile(displayName: string, username: string): Promise<void> {
    await this.page.getByLabel('Display name').fill(displayName)
    await this.page.getByLabel('Username').fill(username)
    await this.page.getByRole('button', { name: 'Add profile' }).click()
  }

  async verifyProfileListed(displayName: string, username: string): Promise<void> {
    const row = this.page.getByRole('listitem').filter({ hasText: `@${username}` })
    await expect(row).toContainText(displayName)
  }

  async verifyNoProfiles(): Promise<void> {
    await expect(this.page.getByText('No profiles yet. Add one below.')).toBeVisible()
  }

  async renameProfile(from: string, to: string): Promise<void> {
    await this.page.getByRole('button', { name: `Rename ${from}` }).click()
    await this.page.getByLabel('New display name').fill(to)
    await this.page.getByRole('button', { name: 'Save name' }).click()
  }

  async pickWhoIsPlaying(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  async verifyPlayingNow(name: string): Promise<void> {
    await expect(this.page.getByText(`Playing now: ${name}`)).toBeVisible()
    await expect(this.page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async verifyNobodyIsPlaying(): Promise<void> {
    await expect(
      this.page.getByText('Nobody yet. Pick a profile and this device will save to it.'),
    ).toBeVisible()
  }

  /**
   * The one cookie the whole estate reads: boop's "synced as X" chip and its
   * whole sync module hang off exactly these claims.
   */
  async verifyFamilySessionNames(name: string, role: 'parent' | 'child'): Promise<void> {
    await expect.poll(() => this.familySessionClaims()).toMatchObject({ name, role })
  }

  async verifyNoFamilySession(): Promise<void> {
    await expect.poll(() => this.familySessionClaims()).toBeNull()
  }

  private async familySessionClaims(): Promise<Record<string, unknown> | null> {
    const cookies = await this.page.context().cookies()
    const cookie = cookies.find((c) => c.name === FAMILY_SESSION_COOKIE)
    if (!cookie || cookie.value === '') return null
    const payload = cookie.value.split('.')[0] ?? ''
    return this.page.evaluate((encoded) => {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      return JSON.parse(atob(padded)) as Record<string, unknown>
    }, payload)
  }

  async signOut(): Promise<void> {
    await this.page.getByRole('button', { name: 'Sign out' }).click()
  }

  async deleteAccount(): Promise<void> {
    await this.page.getByRole('button', { name: 'Delete account' }).click()
    await this.page.getByRole('button', { name: 'Yes, delete everything' }).click()
  }

  async startThenAbandonDeletingTheAccount(): Promise<void> {
    await this.page.getByRole('button', { name: 'Delete account' }).click()
    await expect(this.page.getByRole('button', { name: 'Yes, delete everything' })).toBeVisible()
    await this.page.getByRole('button', { name: 'Keep my account' }).click()
    await expect(this.page.getByRole('button', { name: 'Yes, delete everything' })).toHaveCount(0)
  }
}
