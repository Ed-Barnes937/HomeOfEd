import { Handler, type AppContext } from '@hoe/backend-kit'

import type { StatusStore } from '../store.ts'

export interface HealthResult {
  ok: true
  value: string
}

export class HealthHandler extends Handler<void, HealthResult, StatusStore> {
  async run(_input: void, ctx: AppContext<StatusStore>): Promise<HealthResult> {
    ctx.logger.debug('health.ping')
    return ctx.store.ping()
  }
}
