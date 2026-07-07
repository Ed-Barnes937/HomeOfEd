import { Handler, type AppContext } from '@hoe/backend-kit'

import type { SproutStore } from '../../store.ts'
import { requireChild } from '../authz.ts'
import { type ChildConfig, loadChildConfig } from './loadChildConfig.ts'

/**
 * children.myConfig — the authenticated CHILD reads their OWN guardrail config
 * (sliders + calibration). Powers the chat client's session-limit banner /
 * intent gate. Child-scoped: identity comes from `ctx.auth` (the signed child
 * cookie), never input — so a child can only ever read their own config (#36).
 * The SSE route loads the same config server-side; this exists so the client
 * can render the limit UI without the client ever authoring config.
 */
export class MyConfigHandler extends Handler<void, ChildConfig, SproutStore> {
  async run(_input: void, ctx: AppContext<SproutStore>): Promise<ChildConfig> {
    const child = requireChild(ctx)
    return loadChildConfig(ctx.store, child.id)
  }
}
