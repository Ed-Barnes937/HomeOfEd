// page.route SSE simulator for the chat `.iwft` flows (the sanctioned fallback,
// plan §5.4/§7). The chat stream is NOT tRPC, so the PGlite trampoline in
// mountApp does not serve it — everything else on the chat page still goes
// through the real router over PGlite; only `POST /api/chat/stream` is scripted
// here. This is the sprout equivalent of the source's
// `setChatStreamScenario({ tokens, flag })`.
import type { Page } from '@playwright/test'

import type { PipelineFlag } from '../lib/chatStream.ts'

export interface ChatStreamScenario {
  /** Ordered AI tokens to stream (concatenated into the AI message). */
  tokens: string[]
  /** Optional guardrail flag emitted before the tokens (prod persists it
   * server-side; here it just exercises the client's flagged path). */
  flag?: PipelineFlag
  /** Optional terminal error frame instead of a clean stream. */
  error?: string
  /** Delay before responding — used to keep a stream open long enough to test
   * abort/cancel on navigation. */
  delayMs?: number
}

/** Intercept the chat SSE route and emit scripted `text/event-stream` frames. */
export async function installChatStreamRoute(
  page: Page,
  scenario: ChatStreamScenario,
): Promise<void> {
  await page.route('**/api/chat/stream', async (route) => {
    const frames: string[] = []
    if (scenario.flag) frames.push(`data: ${JSON.stringify({ flag: scenario.flag })}\n\n`)
    for (const token of scenario.tokens) frames.push(`data: ${JSON.stringify({ token })}\n\n`)
    if (scenario.error) frames.push(`data: ${JSON.stringify({ error: scenario.error })}\n\n`)
    frames.push('data: [DONE]\n\n')

    if (scenario.delayMs) await new Promise((resolve) => setTimeout(resolve, scenario.delayMs))
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: frames.join(''),
    })
  })
}
