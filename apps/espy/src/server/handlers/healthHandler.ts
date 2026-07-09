import { Handler, type AppContext } from '@hoe/backend-kit'

export interface HealthResult {
  ok: true
}

/**
 * Stateless handler: no Store (ADR 0008). Shallow liveness only — no I/O, so
 * there's nothing to read from the auth seam either; it exists to satisfy the
 * platform's layered-backend convention and back `/health`.
 */
export class HealthHandler extends Handler<void, HealthResult, void> {
  // Not `async`: this handler does no I/O, so there is nothing to await. It
  // still returns a Promise to satisfy the Handler contract.
  run(_input: void, ctx: AppContext<void>): Promise<HealthResult> {
    ctx.logger.debug('health.run')
    return Promise.resolve({ ok: true })
  }
}
