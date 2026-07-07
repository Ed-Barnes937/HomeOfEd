import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

// childAuth procedures are PUBLIC (no session yet), so these flows mount
// anonymously (no mountApp({ user })). The browser-safe testHasher stores hashes
// as `test:<plain>` — seeds set password/pin hashes accordingly.

const seedDefaultCredentialChild = async (db: {
  execute: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Parent', 'p@test.com')`)
  // Default credential: password == username, mustChangePassword still set.
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Alex', 'alex1234', 'test:alex1234', 'test:5678', true, 'confident-reader')`,
  )
}

const seedEstablishedChild = async (db: {
  execute: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Parent', 'p@test.com')`)
  // Real password already set (mustChangePassword false), PIN 5678.
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Alex', 'alex1234', 'test:realpass', 'test:5678', false, 'confident-reader')`,
  )
}

test('a default-credential child must set a new password before reaching home', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({ seed: seedDefaultCredentialChild })
  await root.goto('/child/login')

  // New device → username/password form.
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 10_000 })
  await root.fillByLabel('Username', 'alex1234')
  await root.fillByLabel('Password', 'alex1234')
  await root.clickButton('Log in')

  // Default credential forces the password change first.
  await root.expectText('Set a new password')
  await root.expectNotText('Start a new conversation')

  await root.fillByLabel('New password', 'rainbow42')
  await root.fillByLabel('Confirm password', 'rainbow42')
  await root.clickButton('Save and continue')

  // Now the child lands on home.
  await root.expectText('Hi, Alex!')
  await root.expectText('Start a new conversation')
})

test('an established child can log in by password then by PIN on the now-known device', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({ seed: seedEstablishedChild })
  await root.goto('/child/login')

  // First login by password registers the device + stores the device token.
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 10_000 })
  await root.fillByLabel('Username', 'alex1234')
  await root.fillByLabel('Password', 'realpass')
  await root.clickButton('Log in')
  await root.expectText('Start a new conversation')

  // Back to login: the device is now known → profile picker → PIN.
  await root.goto('/child/login')
  await root.clickButton('Alex')
  await root.expectText('Enter your PIN.')
  await root.fillByPlaceholder('****', '5678')
  await root.clickButton('Go')

  await root.expectText('Hi, Alex!')
  await root.expectText('Start a new conversation')
})

test('a deep link with a pre-selected child on a known device jumps straight to PIN', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({ seed: seedEstablishedChild })
  await root.goto('/child/login')

  // First password login registers the device (device token in localStorage).
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 10_000 })
  await root.fillByLabel('Username', 'alex1234')
  await root.fillByLabel('Password', 'realpass')
  await root.clickButton('Log in')
  await root.expectText('Start a new conversation')

  // The dashboard's deep link (?child=<id>) skips the profile picker and lands
  // straight on the PIN screen for that child.
  await root.goto('/child/login?child=11111111-1111-4111-8111-111111111111')
  await root.expectText('Enter your PIN.')
  await root.fillByPlaceholder('****', '5678')
  await root.clickButton('Go')

  await root.expectText('Hi, Alex!')
})
