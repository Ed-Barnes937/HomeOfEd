import { test } from './testing/iwftTest.tsx'
import { asParent } from './testing/users.ts'

const CHILD_ID = '11111111-1111-4111-8111-111111111111'

// Seeds are serialised (fn.toString) and re-evaluated in the browser with NO
// access to module scope — so the child UUID is inlined literally, not closed
// over. The goto() below (Node side) may use the CHILD_ID constant.
const seedChild = async (db: { execute: (sql: string) => Promise<unknown> }): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Alice', 'alice@test.com')`)
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', false, 'confident-reader')`,
  )
}

test('parent changes a child preset and it is saved', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedChild })
  await root.goto(`/parent/children/${CHILD_ID}`)

  await root.expectText("Ben's Settings")
  await root.clickButton('Independent explorer')
  await root.expectText('Preset saved')
})

test('parent adds an inspire-me topic', async ({ mountApp }) => {
  const { root } = await mountApp({ user: asParent('p1'), seed: seedChild })
  await root.goto(`/parent/children/${CHILD_ID}`)

  await root.expectText("Ben's Settings")
  await root.fillByLabel('New topic', 'Dinosaurs')
  await root.clickButton('Add')
  await root.expectText('Dinosaurs')
})

test('a parent cannot open a child they do not own', async ({ mountApp }) => {
  // Authenticated as a different parent with no children → ownership check 403s,
  // so the child is never found and the page shows the not-found state.
  const { root } = await mountApp({
    user: asParent('intruder'),
    seed: async (db) => {
      await db.execute(
        `insert into "user" (id, name, email) values ('p1', 'Alice', 'alice@test.com'), ('intruder', 'Mallory', 'm@test.com')`,
      )
      await db.execute(
        `insert into children (id, parent_id, display_name, username, password_hash, must_change_password, preset_name)
         values ('11111111-1111-4111-8111-111111111111', 'p1', 'Ben', 'ben1234', 'test:ben1234', false, 'confident-reader')`,
      )
    },
  })
  await root.goto(`/parent/children/${CHILD_ID}`)
  await root.expectText('Child not found.')
})
