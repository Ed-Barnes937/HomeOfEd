import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { SERVICE_DOWN } from '../features/account/accountQueries.ts'
import {
  type KeyValueStorage,
  recordSilentRenewal,
  REMEMBERED_PROFILE_KEY,
  SILENT_RENEWAL_KEY,
  silentRenewalAllowed,
} from '../features/account/silentRenewal.ts'

import {
  FAMILY_DOWN_KEY,
  FAMILY_HANGS_KEY,
  FAMILY_INVITE_CODE,
  FAMILY_SEED_KEY,
  type FamilySeed,
  FIXTURE_PARENT,
  type CountedFamilyCall,
  FAMILY_CALLS_KEY,
} from './familyFixture.ts'

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

  /**
   * Before mounting: put the URL the estate gate's 302 leaves in the address bar,
   * so the app first loads on it as a visitor's does (and the router's mount-time
   * rewrite of the URL happens too). The browser carries the fragment over.
   */
  static async openFromGate(
    page: Page,
    returnTo: string,
    fragment = '',
    path = '/account',
  ): Promise<void> {
    const url = `${path}?returnTo=${encodeURIComponent(returnTo)}${fragment}`
    await page.evaluate((target) => window.history.pushState({}, '', target), url)
  }

  /** Before mounting: every family call fails, as when the service is down. */
  static async givenFamilyIsDown(page: Page): Promise<void> {
    await page.evaluate((key) => {
      ;(globalThis as unknown as Record<string, unknown>)[key] = true
    }, FAMILY_DOWN_KEY)
  }

  /** Before mounting: the family service never answers `identity.me`. */
  static async givenFamilyHangs(page: Page): Promise<void> {
    await page.evaluate((key) => {
      ;(globalThis as unknown as Record<string, unknown>)[key] = true
    }, FAMILY_HANGS_KEY)
  }

  /** Before mounting: the browser silently drops every cookie write. */
  static async givenCookieWritesDropped(page: Page): Promise<void> {
    await page.evaluate(() => {
      const real = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => real.get!.call(document) as string,
        set: () => undefined,
      })
    })
  }

  /** Before mounting: `sessionStorage` reads but refuses writes, as when full. */
  static async givenSessionStorageRefusesWrites(page: Page): Promise<void> {
    await page.evaluate(() => {
      type SetItem = (this: Storage, key: string, value: string) => void
      const realSetItem: SetItem = Reflect.get(Storage.prototype, 'setItem')
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === window.sessionStorage) throw new DOMException('full', 'QuotaExceededError')
        realSetItem.call(this, key, value)
      }
    })
  }

  /** Before mounting: what a parent arranged on an earlier visit (FamilySeed). */
  static async givenFamily(page: Page, seed: FamilySeed): Promise<void> {
    await page.evaluate(
      ({ key, value }) => {
        ;(globalThis as unknown as Record<string, unknown>)[key] = value
      },
      { key: FAMILY_SEED_KEY, value: seed },
    )
  }

  /** Before mounting: hub silently renewed for `returnTo` in this tab a moment ago. */
  static async givenRenewedSilentlyMomentsAgo(page: Page, returnTo: string): Promise<void> {
    const entries = new Map<string, string>()
    const storage: KeyValueStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => void entries.set(key, value),
      removeItem: (key) => void entries.delete(key),
    }
    recordSilentRenewal(returnTo, Date.now(), storage)
    await page.evaluate(
      (written) => {
        for (const [key, value] of written) sessionStorage.setItem(key, value)
      },
      [...entries],
    )
  }

  /** Before mounting: this device already holds a family cookie for `name`. */
  static async givenPlaying(page: Page, name: string, sub = 'parent-elsewhere'): Promise<void> {
    const now = Date.now()
    const claims = { sub, role: 'parent', name, iat: now, exp: now + 86_400_000 }
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
    await page.context().addCookies([
      { name: FAMILY_SESSION_COOKIE, value: `${payload}.unsigned`, url: page.url() },
    ])
  }

  async verifyArrived(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  }

  /** The browser keeps refusing the family cookie: writes are silently dropped. */
  async dropCookieWrites(): Promise<void> {
    await AccountPagePom.givenCookieWritesDropped(this.page)
  }

  /** The loop guard holds a record for `returnTo` that refuses another renewal now. */
  async verifySilentRenewalRecorded(returnTo: string): Promise<void> {
    const raw = await this.page.evaluate((key) => sessionStorage.getItem(key), SILENT_RENEWAL_KEY)
    const recorded = new Map(raw === null ? [] : [[SILENT_RENEWAL_KEY, raw]])
    const storage: KeyValueStorage = {
      getItem: (key) => recorded.get(key) ?? null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    expect(silentRenewalAllowed(returnTo, Date.now(), storage)).toBe(false)
  }

  async verifyNoTokenMinted(): Promise<void> {
    await this.verifyFamilyCalls('mintSessionToken', 0)
  }

  async verifyFamilyCalls(method: CountedFamilyCall, count: number): Promise<void> {
    const calls = await this.page.evaluate(
      (key) => (globalThis as unknown as Record<string, Record<CountedFamilyCall, number>>)[key],
      FAMILY_CALLS_KEY,
    )
    expect(calls?.[method]).toBe(count)
  }

  async verifyLoadingFamily(): Promise<void> {
    await expect(this.page.getByText('Loading your family…')).toBeVisible()
  }

  /** The device's clock runs past the token's 30 days; the service's does not. */
  async moveDeviceClockPastTokenExpiry(): Promise<void> {
    await this.page.clock.install({ time: Date.now() + 31 * 86_400_000 })
  }

  async goBack(): Promise<void> {
    await this.page.goBack()
  }

  async verifyNotOnAccount(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/account/)
  }

  async verifyFamilyIsDown(): Promise<void> {
    await expect(this.page.getByText(SERVICE_DOWN)).toBeVisible()
  }

  async verifyPlayingNote(name: string): Promise<void> {
    await expect(this.page.getByText(`Playing now: ${name}`)).toBeVisible()
  }

  /** Stand in for the estate apps' origins, so a return lands on a real page. */
  async serveEstateApps(): Promise<void> {
    await AccountPagePom.serveEstateApps(this.page)
  }

  /** Before mounting too, for a return that happens with no screen. */
  static async serveEstateApps(page: Page): Promise<void> {
    await page.route(/^https:\/\/[a-z]+\.homeofed\.com\//, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>an estate app</h1>' }),
    )
  }

  async verifyReturnedTo(url: string): Promise<void> {
    await expect(this.page).toHaveURL(url)
  }

  async verifyStillOnAccount(): Promise<void> {
    await expect(this.page).toHaveURL(/\/account(\?|#|$)/)
    await expect(this.page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  }

  async verifyOffersSharedItem(href: string, opts: { timeout?: number } = {}): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'Open what was shared' })).toHaveAttribute(
      'href',
      href,
      opts,
    )
  }

  async verifyOffersNoSharedItem(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'Open what was shared' })).toHaveCount(0)
  }

  async verifySharedItemNotOffered(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'Open what was shared' })).toHaveCount(0)
  }

  async openSharedItem(): Promise<void> {
    await this.page.getByRole('link', { name: 'Open what was shared' }).click()
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

  async verifyProfileNotListed(username: string): Promise<void> {
    await expect(this.page.getByRole('listitem').filter({ hasText: `@${username}` })).toHaveCount(
      0,
    )
  }

  /** The browser-side half of the bound: the server's refusal is not prose. */
  async verifyNameFieldsAreBounded(): Promise<void> {
    await expect(this.page.getByLabel('Display name')).toHaveAttribute('maxlength', '32')
    await expect(this.page.getByLabel('Username')).toHaveAttribute('maxlength', '32')
  }

  async verifyAddProfileIsRefusedUntilBothFieldsHaveContent(): Promise<void> {
    const add = this.page.getByRole('button', { name: 'Add profile' })
    await expect(add).toBeDisabled()
    await this.page.getByLabel('Display name').fill('Robin')
    await expect(add).toBeDisabled()
    await this.page.getByLabel('Username').fill('   ')
    await expect(add).toBeDisabled()
  }

  /** Nothing on a parent's screen may be a stringified zod issue array. */
  async verifyNoMachineOutputIsShown(): Promise<void> {
    await expect(this.page.getByText('"code":')).toHaveCount(0)
    await expect(this.page.getByText('Invalid input')).toHaveCount(0)
    await expect(this.page.getByText('Too big:')).toHaveCount(0)
  }

  async verifyNoProfiles(): Promise<void> {
    await expect(this.page.getByText('No profiles yet. Add one below.')).toBeVisible()
  }

  async editProfile(
    displayName: string,
    changes: { displayName?: string; username?: string },
  ): Promise<void> {
    await this.page.getByRole('button', { name: `Edit ${displayName}`, exact: true }).click()
    if (changes.displayName !== undefined) {
      await this.page.getByLabel('New display name').fill(changes.displayName)
    }
    if (changes.username !== undefined) {
      await this.page.getByLabel('New username').fill(changes.username)
    }
    await this.page.getByRole('button', { name: 'Save changes' }).click()
  }

  async cancelEditingProfile(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel changes' }).click()
  }

  async deleteProfile(displayName: string): Promise<void> {
    await this.page.getByRole('button', { name: `Delete ${displayName}`, exact: true }).click()
    await this.page.getByRole('button', { name: `Yes, delete ${displayName}` }).click()
  }

  async startThenAbandonDeletingProfile(displayName: string): Promise<void> {
    const confirm = this.page.getByRole('button', { name: `Yes, delete ${displayName}` })
    await this.page.getByRole('button', { name: `Delete ${displayName}`, exact: true }).click()
    await expect(confirm).toBeVisible()
    await this.page.getByRole('button', { name: `Keep ${displayName}` }).click()
    await expect(confirm).toHaveCount(0)
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

  /**
   * Read off the real browser jar, not `document.cookie`, so the attributes are
   * the ones the browser actually stored. `Domain` and `Secure` are the
   * production pair and cannot be set from localhost - those are pinned exactly
   * by the unit test over `familySessionCookieString`.
   */
  async verifyFamilyCookieAttributes(): Promise<void> {
    const cookies = await this.page.context().cookies()
    const cookie = cookies.find((c) => c.name === FAMILY_SESSION_COOKIE)
    expect(cookie).toMatchObject({
      path: '/',
      sameSite: 'Lax',
      // Deliberately readable by script: boop reads these claims for its chip.
      httpOnly: false,
    })
    const days = (cookie!.expires - Date.now() / 1000) / 86400
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThanOrEqual(30)
  }

  /** Silent renewal re-mints for whoever was last picked on this device. */
  async verifyRemembersWhoIsPlaying(): Promise<void> {
    const claims = await this.familySessionClaims()
    expect(claims).not.toBeNull()
    await expect.poll(() => this.rememberedProfile()).toBe(claims!.sub)
  }

  async verifyRemembersNobody(): Promise<void> {
    await expect.poll(() => this.rememberedProfile()).toBeNull()
  }

  private rememberedProfile(): Promise<string | null> {
    return this.page.evaluate((key) => localStorage.getItem(key), REMEMBERED_PROFILE_KEY)
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
