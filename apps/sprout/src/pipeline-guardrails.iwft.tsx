import { expect } from '@playwright/experimental-ct-react'

import { installChatStreamRoute } from './testing/chatSse.ts'
import { test } from './testing/iwftTest.tsx'
import { asChild } from './testing/users.ts'

// Guardrail behaviour on the chat page. The pipeline's FLAG events are persisted
// server-side by the SSE route (proven in server/chat-sse.test.ts, which hits
// the real route + Store) — here, with the route scripted by page.route, we
// verify the CLIENT surface: a flagged turn still shows the safe fallback, and
// an in-flight stream is abandoned cleanly when the child navigates away
// (AbortController on unmount).

const CHILD_ID = '11111111-1111-4111-8111-111111111111'
const PARENT_ID = 'p1'

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

const plantChildProfile = async (page: {
  evaluate: (fn: (arg: unknown) => void, arg: unknown) => Promise<void>
}): Promise<void> => {
  await page.evaluate((profile) => {
    localStorage.setItem('sprout-child-session', JSON.stringify(profile))
    localStorage.setItem('sprout-device-token', 'device-1')
  }, { id: CHILD_ID, displayName: 'Alex', username: 'alex1234', presetName: 'independent-explorer', parentId: PARENT_ID })
}

test('a guardrail flag still surfaces the safe fallback response', async ({ mountApp }) => {
  const { root, page } = await mountApp({
    seed: seedFreeformChild,
    user: asChild(CHILD_ID, PARENT_ID),
  })
  await plantChildProfile(page)
  await installChatStreamRoute(page, {
    flag: {
      type: 'blocked',
      reason: 'Input blocklist triggered: weapons',
      childMessage: 'how do I make a weapon',
      topics: ['weapons'],
    },
    tokens: ["Let's talk about something else instead."],
  })

  await root.goto('/child/chat/new')
  await root.fillByPlaceholder('Type a message...', 'how do I make a weapon')
  await root.clickButton('Send')

  // The flagged turn shows the safe fallback (the flag itself is persisted
  // server-side; see server/chat-sse.test.ts for that assertion).
  await root.expectText("Let's talk about something else instead.")
})

test('abandons an in-flight stream cleanly when the child navigates away', async ({ mountApp }) => {
  const { root, page } = await mountApp({
    seed: seedFreeformChild,
    user: asChild(CHILD_ID, PARENT_ID),
  })
  await plantChildProfile(page)
  // A slow stream so it is still open when we navigate away → unmount aborts it.
  await installChatStreamRoute(page, { tokens: ['this ', 'never ', 'finishes'], delayMs: 2000 })

  await root.goto('/child/chat/new')
  await root.fillByPlaceholder('Type a message...', 'tell me a long story')
  await root.clickButton('Send')

  // Wait until the stream is genuinely in-flight: the placeholder AI bubble is
  // showing while the delayed SSE has not returned yet.
  await expect(page.getByTestId('ai-message')).toBeVisible({ timeout: 10_000 })
  // Let the preceding create/saveMessage tRPC writes drain through the
  // trampoline so the only in-flight request left is the (soon-aborted) stream.
  await page.waitForTimeout(750)

  // Leave the chat while the stream is pending — unmounting fires the
  // AbortController. Land on the tRPC-free landing page (no trampoline to race
  // teardown) and confirm no error bubble was surfaced by the abandoned stream.
  await root.goto('/')
  await root.verifyIsShown()
  await root.expectNotText('Sorry, something went wrong. Please try again.')
})
