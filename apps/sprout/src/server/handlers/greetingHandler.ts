import { Handler, type AppContext } from '@hoe/backend-kit'

import type { SproutStore } from '../store.ts'

export interface GreetingResult {
  ok: true
  value: string
}

/**
 * P0 scaffolding demo (P3 replaces it). It reads the auth seam and otherwise
 * just computes; it never touches `ctx.store`. Its Store type parameter is
 * `SproutStore` only so it shares the router's context type after the P1 DB
 * wiring — the store is deliberately ignored here.
 */
export class GreetingHandler extends Handler<void, GreetingResult, SproutStore> {
  // Not `async`: this handler does no I/O, so there is nothing to await. It
  // still returns a Promise to satisfy the Handler contract — a real DB-backed
  // handler would be `async` and `await ctx.store...`.
  run(_input: void, ctx: AppContext<SproutStore>): Promise<GreetingResult> {
    ctx.logger.debug('greeting.run')
    const user = ctx.auth.getUser()
    return Promise.resolve({
      ok: true,
      value: user ? `hello, ${user.id}` : 'hello from the sprout',
    })
  }
}
