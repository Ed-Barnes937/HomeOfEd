import { Handler } from '@hoe/backend-kit'
import { z } from 'zod'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

/**
 * Having a parser at all is half the point: a procedure without one never reads
 * the request body, which is what let a preflight-free POST reach this (ADR 0078).
 */
export const deleteAccountInputSchema = z.object({ confirm: z.literal(true) })

export interface DeleteAccountResult {
  ok: true
}

/** Erases the household: the parent, its profiles, and every save row they own. */
export class DeleteAccountHandler extends Handler<void, DeleteAccountResult, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<DeleteAccountResult> {
    const parent = requireParent(ctx)
    await ctx.store.deleteAccount(parent.id)
    return { ok: true }
  }
}
