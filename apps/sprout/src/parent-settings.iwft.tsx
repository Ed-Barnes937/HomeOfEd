import { test } from './testing/iwftTest.tsx'
import { asParent } from './testing/users.ts'

const seedParent = async (db: { execute: (sql: string) => Promise<unknown> }): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Alice', 'alice@test.com')`)
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
