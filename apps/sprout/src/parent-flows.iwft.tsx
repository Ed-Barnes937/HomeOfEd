import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'
import { installParentAuthRoute } from './testing/parentAuthRoute.ts'
import { asParent } from './testing/users.ts'

// Self-contained seed (crosses the Node→browser boundary as source text — no
// imports, only raw SQL through `db`). A parent `user` row is required: children
// FK to user.id (schema §5.2). Ben has 2 conversations / 3 messages / 2
// unreviewed flags; Clara has 1 conversation / 2 messages / 1 flag.
const seedDashboard = async (db: {
  execute: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`)
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', 'test:1234', false, 'early-learner'),
            ('22222222-2222-4222-8222-222222222222', 'p1', 'Clara', 'clara5678', 'test:clara5678', 'test:5678', false, 'confident-reader')`,
  )
  await db.execute(
    `insert into conversations (id, child_id, title) values
       ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Space chat'),
       ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Animal chat'),
       ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'Maths chat')`,
  )
  await db.execute(
    `insert into messages (conversation_id, role, content) values
       ('33333333-3333-4333-8333-333333333333', 'child', 'Tell me about stars'),
       ('33333333-3333-4333-8333-333333333333', 'ai', 'Stars are big balls of gas!'),
       ('44444444-4444-4444-8444-444444444444', 'child', 'What is a dog?'),
       ('55555555-5555-4555-8555-555555555555', 'child', 'What is 2+2?'),
       ('55555555-5555-4555-8555-555555555555', 'ai', '2+2 is 4!')`,
  )
  await db.execute(
    `insert into flags (child_id, conversation_id, type, reason, topics, reviewed) values
       ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'sensitive', 'Sensitive topic detected', '["space","science"]', false),
       ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'blocked', 'Content blocked', '["animals"]', false),
       ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555555', 'sensitive', 'Sensitive topic', '["numbers"]', false)`,
  )
}

test('dashboard shows a tab per child and the first child summary', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedDashboard })
  await root.goto('/parent/dashboard')

  await root.verifyDashboardShown()
  await root.verifyChildTab('Ben')
  await root.verifyChildTab('Clara')
  await root.verifyTabSelected('Ben')

  // Ben's stats + topics.
  await root.expectText('3 messages')
  await root.expectText('2 conversations')
  await root.expectText('2 unreviewed flags')
  await root.expectText('space')
})

test('dashboard links to the child login for the active child, pre-selected', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({ user: asParent('p1'), seed: seedDashboard })
  await root.goto('/parent/dashboard')

  await root.verifyTabSelected('Ben')
  const benLink = page.getByRole('link', { name: 'Log in as Ben' })
  await expect(benLink).toBeVisible({ timeout: 10_000 })
  await expect(benLink).toHaveAttribute(
    'href',
    '/child/login?child=11111111-1111-4111-8111-111111111111',
  )
  // The username is visible at the point of use so the parent can relay it.
  await root.expectText('signs in as ben1234')

  // The link follows the active child.
  await root.selectChildTab('Clara')
  const claraLink = page.getByRole('link', { name: 'Log in as Clara' })
  await expect(claraLink).toHaveAttribute(
    'href',
    '/child/login?child=22222222-2222-4222-8222-222222222222',
  )
  await root.expectText('signs in as clara5678')
})

test('a child signs in from the parent account with just their PIN, even on a new device', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({ user: asParent('p1'), seed: seedDashboard })
  await root.goto('/child/login?child=11111111-1111-4111-8111-111111111111')

  await root.expectText('Hi, Ben!')
  await root.expectText('Enter your PIN.')
  await expect(page.getByLabel('Password')).toHaveCount(0)

  await root.fillByPlaceholder('****', '9999')
  await root.clickButton('Go', { exact: true })
  await root.expectText('Incorrect PIN.')

  await root.fillByPlaceholder('****', '1234')
  await root.clickButton('Go', { exact: true })
  await root.expectText('Start a new conversation')
})

test('a parent-account sign-in for a child with a reset PIN falls back to password', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({
    user: asParent('p1'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`,
      )
      await db.execute(
        `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
         values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', null, true, 'early-learner')`,
      )
    },
  })
  await root.goto('/child/login?child=11111111-1111-4111-8111-111111111111')

  await expect(page.getByLabel('Password')).toBeVisible({ timeout: 10_000 })
  await root.expectNotText('Enter your PIN.')
})

test('children list shows each child sign-in username', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedDashboard })
  await root.goto('/parent/children')

  await root.expectText('signs in as ben1234')
  await root.expectText('signs in as clara5678')
})

test('switching tabs changes the summary panel', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedDashboard })
  await root.goto('/parent/dashboard')

  await root.verifyChildTab('Clara')
  await root.expectText('3 messages')

  await root.selectChildTab('Clara')
  await root.expectText('2 messages')
  await root.expectText('1 conversation')
  await root.expectText('1 unreviewed flag')
})

test('empty state when the parent has no children', async ({ mountApp }) => {
  const { root } = await mountApp({
    user: asParent('solo'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('solo', 'Solo', 'solo@test.com', now(), now())`,
      )
    },
  })
  await root.goto('/parent/dashboard')

  await root.verifyDashboardShown()
  await root.expectText('No children yet. Add your first child to get started.')
})

test('unauthenticated parent is redirected to login', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.goto('/parent/dashboard')
  // The session probe (children.list) throws UNAUTHORIZED → redirect to login.
  await expect(page.getByRole('heading', { name: 'Parent login' })).toBeVisible({ timeout: 10_000 })
})

// ADR-0014 / ADR-0015: the two legal checkboxes gate submission (the server
// hook is the control; this proves the form-side UX). Copy is counsel-flagged
// — do not reword.
test('registration submit is blocked until both legal checkboxes are ticked', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.goto('/parent/register')

  await root.fillByLabel('Your name', 'Alice')
  await root.fillByLabel('Email', 'alice@test.com')
  await root.fillByLabel('Password', 'correct-horse-battery')
  await root.fillByLabel('Confirm password', 'correct-horse-battery')
  await root.fillByLabel('Invite code', 'family-pilot')

  await root.verifyButtonEnabled('Create account', false)

  await root.tickCheckbox('I confirm I live in the United Kingdom')
  await root.verifyButtonEnabled('Create account', false)

  await root.tickCheckbox('I agree to the Terms of Service and have read the Privacy Policy')
  await root.verifyButtonEnabled('Create account', true)
})

test('parent creates a child through onboarding and it appears on the dashboard', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({
    user: asParent('p1'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`,
      )
    },
  })
  await root.goto('/parent/onboarding')

  // Step 1
  await root.expectText('Add a child')
  await root.fillByLabel("Child's name", 'Alex')
  await root.expectText('Early learner')
  await root.fillByLabel('4-digit PIN', '1234')
  await root.clickButton('Next')

  // Step 2 — skip calibration
  await root.expectText('Sensitive topic calibration')
  await page.getByText('Skip calibration').click()

  // Step 3 — review + create
  await root.expectText('Review & confirm')
  await root.expectText('Skipped — using defaults')
  await root.clickButton("Create Alex's account")

  await root.expectText("Alex's account is ready!")
  await expect(page.getByText(/^alex\d{4}$/).first()).toBeVisible()

  await root.clickButton('Go to dashboard')
  await root.verifyDashboardShown()
  await root.verifyChildTab('Alex')
})

test('a parent bounced to login returns to the screen they asked for', async ({ mountApp }) => {
  const { root, page } = await mountApp({ seed: seedDashboard })
  await installParentAuthRoute(page, { id: 'p1', email: 'alice@test.com', password: 'grownup-pass' })
  await root.goto('/parent/flags')

  await expect(page.getByRole('heading', { name: 'Parent login' })).toBeVisible({ timeout: 10_000 })
  await root.fillByLabel('Email', 'alice@test.com')
  await root.fillByLabel('Password', 'grownup-pass')
  await root.clickButton('Log in')

  await expect(page.getByRole('heading', { name: 'Flagged Conversations' })).toBeVisible({
    timeout: 10_000,
  })
})
