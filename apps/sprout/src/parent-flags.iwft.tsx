import { test } from './testing/iwftTest.tsx'
import { asParent } from './testing/users.ts'

const seedFlags = async (db: { execute: (sql: string) => Promise<unknown> }): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Alice', 'alice@test.com')`)
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
  await root.markFirstFlagReviewed()
  await root.verifyReviewedCount(1)
})

test('filtering by child narrows the list client-side', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedFlags })
  await root.goto('/parent/flags')

  await root.verifyFlagCount(3)
  await root.filterFlagsByChild('Ben')
  await root.verifyFlagCount(2)
})

test('empty state when the parent has no flags', async ({ mountApp }) => {
  const { root } = await mountApp({
    user: asParent('p1'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email) values ('p1', 'Alice', 'alice@test.com')`,
      )
    },
  })
  await root.goto('/parent/flags')

  await root.expectText('No flagged conversations found.')
})
