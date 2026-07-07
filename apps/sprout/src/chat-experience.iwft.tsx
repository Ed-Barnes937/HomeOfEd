import { expect } from '@playwright/experimental-ct-react'

import { installChatStreamRoute } from './testing/chatSse.ts'
import { test } from './testing/iwftTest.tsx'
import { asChild } from './testing/users.ts'

// The chat page is dual-transport (plan §5.4): the child + AI messages and the
// child's own config go through the real router over PGlite (child-authenticated
// via the mountApp({ user }) header), while `POST /api/chat/stream` is scripted
// by the page.route SSE simulator. Chat depends on a localStorage child
// PROFILE, so we plant it before navigating (it is the UI record, not the auth
// credential — auth here is the test-user header).

const CHILD_ID = '11111111-1111-4111-8111-111111111111'
const PARENT_ID = 'p1'
const CONVO_ID = '22222222-2222-4222-8222-222222222222'

// Freeform child (interaction_mode 5 → no intent gate), unlimited session.
const seedFreeformChild = async (db: {
  execute: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Parent', 'p@test.com')`)
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Alex', 'alex1234', 'test:pw', 'test:5678', false, 'independent-explorer')`,
  )
  await db.execute(
    `insert into presets (child_id, name, vocabulary_level, response_depth, answering_style, interaction_mode, topic_access, session_limits, parent_visibility)
     values ('11111111-1111-4111-8111-111111111111', 'independent-explorer', 5, 5, 5, 5, 4, 5, 2)`,
  )
}

// Strict child (session_limits 1 → limit 10) with a conversation already at the
// limit (10 messages), for the session-limit banner.
const seedChildAtLimit = async (db: {
  execute: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await db.execute(`insert into "user" (id, name, email) values ('p1', 'Parent', 'p@test.com')`)
  await db.execute(
    `insert into children (id, parent_id, display_name, username, password_hash, pin_hash, must_change_password, preset_name)
     values ('11111111-1111-4111-8111-111111111111', 'p1', 'Alex', 'alex1234', 'test:pw', 'test:5678', false, 'early-learner')`,
  )
  await db.execute(
    `insert into presets (child_id, name, vocabulary_level, response_depth, answering_style, interaction_mode, topic_access, session_limits, parent_visibility)
     values ('11111111-1111-4111-8111-111111111111', 'early-learner', 5, 1, 1, 5, 1, 1, 5)`,
  )
  await db.execute(
    `insert into conversations (id, child_id, title) values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Space')`,
  )
  const rows = Array.from({ length: 10 }, (_, i) => {
    const role = i % 2 === 0 ? 'child' : 'ai'
    return `('22222222-2222-4222-8222-222222222222', '${role}', 'message ${i}')`
  }).join(', ')
  await db.execute(`insert into messages (conversation_id, role, content) values ${rows}`)
}

const plantChildProfile = async (page: {
  evaluate: (fn: (arg: unknown) => void, arg: unknown) => Promise<void>
}): Promise<void> => {
  await page.evaluate((profile) => {
    localStorage.setItem('sprout-child-session', JSON.stringify(profile))
    localStorage.setItem('sprout-device-token', 'device-1')
  }, { id: CHILD_ID, displayName: 'Alex', username: 'alex1234', presetName: 'independent-explorer', parentId: PARENT_ID })
}

test('streams the AI response token-by-token into the transcript', async ({ mountApp }) => {
  const { root, page } = await mountApp({
    seed: seedFreeformChild,
    user: asChild(CHILD_ID, PARENT_ID),
  })
  await plantChildProfile(page)
  await installChatStreamRoute(page, {
    tokens: ['Volcanoes ', 'erupt ', 'when ', 'magma ', 'rises.'],
  })

  await root.goto('/child/chat/new')

  await root.fillByPlaceholder('Type a message...', 'Why do volcanoes erupt?')
  await root.clickButton('Send')

  // The child's message and the streamed AI answer both land in the transcript.
  await root.expectText('Why do volcanoes erupt?')
  await root.expectText('Volcanoes erupt when magma rises.')
})

test('shows the session-limit banner and blocks input at the limit', async ({ mountApp }) => {
  const { root, page } = await mountApp({
    seed: seedChildAtLimit,
    user: asChild(CHILD_ID, PARENT_ID),
  })
  await plantChildProfile(page)
  await installChatStreamRoute(page, { tokens: ['ignored'] })

  await root.goto(`/child/chat/${CONVO_ID}`)

  // 10 seeded messages == the level-1 session limit → the at-limit banner shows
  // and the send button is disabled.
  await expect(page.getByTestId('session-limit')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
})
