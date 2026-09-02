import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { PRIVACY_HTML, TERMS_HTML } from './server/legal-docs.ts'
import { test } from './testing/iwftTest.tsx'
import { asParent } from './testing/users.ts'

// The legal documents are NOT SPA routes (ADR-0015): clicking a Settings link
// is a plain full-page navigation, which the PGlite trampoline never serves —
// so the sanctioned page.route fallback serves the REAL exported document
// strings (their content is proven server-side in server/legal-docs.test.ts).
const installLegalDocRoutes = async (page: Page): Promise<void> => {
  await page.route('**/terms', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: TERMS_HTML }),
  )
  await page.route('**/privacy', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: PRIVACY_HTML }),
  )
}

const seedParent = async (db: { execute: (sql: string) => Promise<unknown> }): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`)
}

test('settings toggles flip and are gated behind a parent session', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedParent })
  await root.goto('/parent/settings')

  await root.expectText('Notification preferences')
  // Defaults: notifications on, dark mode off.
  await root.verifySwitchChecked('Flag notifications', true)
  await root.verifySwitchChecked('Dark mode', false)

  await root.toggleSwitch('Dark mode')
  await root.verifySwitchChecked('Dark mode', true)

  await root.toggleSwitch('Flag notifications')
  await root.verifySwitchChecked('Flag notifications', false)
})

test('the Terms of Service link navigates to the terms document', async ({ mountApp, page }) => {
  await installLegalDocRoutes(page)
  const { root } = await mountApp({ user: asParent('p1'), seed: seedParent })
  await root.goto('/parent/settings')

  await root.clickLink('Terms of Service')

  await expect(page).toHaveURL(/\/terms$/)
  await root.expectText('Draft — not yet in force')
  await root.expectText('UK-only use')
})

test('the Privacy Policy link navigates to the privacy document', async ({ mountApp, page }) => {
  await installLegalDocRoutes(page)
  const { root } = await mountApp({ user: asParent('p1'), seed: seedParent })
  await root.goto('/parent/settings')

  await root.clickLink('Privacy Policy')

  await expect(page).toHaveURL(/\/privacy$/)
  await root.expectText('Draft — not yet in force')
  await root.expectText('What is collected')
})
