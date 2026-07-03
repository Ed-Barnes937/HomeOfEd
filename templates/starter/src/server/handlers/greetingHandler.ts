import { Handler, type AppContext } from '@hoe/backend-kit'

export interface GreetingResult {
  ok: true
  value: string
}

/**
 * Stateless handler: no Store (ADR 0007). It reads the auth seam — which stays
 * frozen and is database-independent — and otherwise just computes. The Store
 * type parameter is `void`; `ctx.store` is never touched. Adding a database
 * later = give this a `<..., YourStore>` and read `ctx.store`.
 */
export class GreetingHandler extends Handler<void, GreetingResult, void> {
  // Not `async`: this handler does no I/O (no Store), so there is nothing to
  // await. It still returns a Promise to satisfy the Handler contract — a
  // DB-backed handler would be `async` and `await ctx.store...`.
  run(_input: void, ctx: AppContext<void>): Promise<GreetingResult> {
    ctx.logger.debug('greeting.run')
    const user = ctx.auth.getUser()
    return Promise.resolve({
      ok: true,
      value: user ? `hello, ${user.id}` : 'hello from the starter',
    })
  }
}
