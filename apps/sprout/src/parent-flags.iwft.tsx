import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'
import { asParent } from './testing/users.ts'

const seedFlags = async (db: { execute: (sql: string) => Promise<unknown> }): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`)
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', false, 'early-learner'),
            ('22222222-2222-4222-8222-222222222222', 'p1', 'Clara', 'clara5678', 'test:clara5678', false, 'confident-reader')`,
  )
  await db.execute(
    `insert into flags (child_id, type, reason, topics, reviewed) values
       ('11111111-1111-4111-8111-111111111111', 'sensitive', 'Ben sensitive one', '["space"]', false),
       ('11111111-1111-4111-8111-111111111111', 'blocked', 'Ben blocked one', '["animals"]', false),
       ('22222222-2222-4222-8222-222222222222', 'sensitive', 'Clara sensitive one', '["numbers"]', false)`,
  )
}

test('flags list shows every owned flag and mark-as-reviewed sticks', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedFlags })
  await root.goto('/parent/flags')

  await root.verifyFlagCount(3)
  await root.verifyFlagTopics(['space', 'animals', 'numbers'])
  await root.markFirstFlagReviewed()
  await root.verifyReviewedCount(1)
})

test('the dashboard "View flags" link reaches the flag log', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedFlags })
  await root.goto('/parent/dashboard')

  await root.verifyDashboardShown()
  await root.clickLink('View flags')
  await root.verifyFlagCount(3)
})

test('filtering by child narrows the list client-side', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedFlags })
  await root.goto('/parent/flags')

  await root.verifyFlagCount(3)
  await root.filterFlagsByChild('Ben')
  await root.verifyFlagCount(2)
})

// Pilot issue 03 (parent flow / safeguarding regression): a flag raised in a
// conversation the child later soft-deleted still appears on the flags page,
// and the conversation detail stays readable, labelled deleted-by-child. The
// old hard delete cascaded the flag (and messages) away entirely.
test('a flag survives the child deleting its conversation; the transcript stays readable and labelled', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp({
    user: asParent('p1'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`,
      )
      await db.execute(
        `insert into children (id, parent_id, display_name, username, password_hash, must_change_password, preset_name)
         values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', false, 'early-learner')`,
      )
      // The conversation is already soft-deleted by the child (deleted_at set).
      await db.execute(
        `insert into conversations (id, child_id, title, deleted_at)
         values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Volcanoes', now())`,
      )
      await db.execute(
        `insert into messages (id, conversation_id, role, content, flagged)
         values ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'ai', 'A worrying answer', true)`,
      )
      await db.execute(
        `insert into flags (child_id, conversation_id, message_id, type, reason, topics, reviewed)
         values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'sensitive', 'Ben sensitive one', '["volcanoes"]', false)`,
      )
    },
  })
  await root.goto('/parent/flags')

  await root.verifyFlagCount(1)
  await page.getByTestId('flag-link').click()

  // The transcript is still readable and carries the deleted-by-child label.
  await root.expectText('A worrying answer')
  await expect(page.getByTestId('deleted-by-child')).toBeVisible({ timeout: 10_000 })
})

test('empty state when the parent has no flags', async ({ mountApp }) => {
  const { root } = await mountApp({
    user: asParent('p1'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email, uk_residence_attested_at, tos_agreed_at) values ('p1', 'Alice', 'alice@test.com', now(), now())`,
      )
    },
  })
  await root.goto('/parent/flags')

  await root.expectText('No flagged conversations found.')
})
