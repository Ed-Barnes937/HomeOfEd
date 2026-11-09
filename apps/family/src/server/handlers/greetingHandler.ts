import { Handler, type AppContext } from '@hoe/backend-kit'

export interface GreetingResult {
  ok: true
  value: string
}

/** A smoke for the layered path, until the real routers land in tickets 04 and 05. */
export class GreetingHandler extends Handler<void, GreetingResult, void> {
  run(_input: void, ctx: AppContext<void>): Promise<GreetingResult> {
    ctx.logger.debug('greeting.run')
    const user = ctx.auth.getUser()
    return Promise.resolve({
      ok: true,
      value: user ? `hello, ${user.id}` : 'hello from the family service',
    })
  }
}
