import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import { toChildAuthProfile, type ChildAuthProfile } from './schemas.ts'
import { verifyChildPin } from './verifyChildPin.ts'

export const loginPinInputSchema = z.object({
  childId: z.string().uuid(),
  pin: z.string().min(1),
  deviceToken: z.string().min(1),
})
export type LoginPinInput = z.infer<typeof loginPinInputSchema>

export interface LoginPinResult {
  child: ChildAuthProfile
  token: string
}

export interface LoginPinDeps {
  hasher: PasswordHasher
  mintChildToken: ChildTokenMinter
}

/**
 * childAuth.loginPin — the PIN re-entry step on an already-registered device.
 * PUBLIC (no session yet). Lockout + pin_fail recording live in `verifyChildPin`.
 * Source parity: unlike loginPassword, this step does not register a device.
 */
export class LoginPinHandler extends Handler<LoginPinInput, LoginPinResult, SproutStore> {
  private readonly hasher: PasswordHasher
  private readonly mintChildToken: ChildTokenMinter

  constructor(deps: LoginPinDeps) {
    super()
    this.hasher = deps.hasher
    this.mintChildToken = deps.mintChildToken
  }

  async run(input: LoginPinInput, ctx: AppContext<SproutStore>): Promise<LoginPinResult> {
    const child = await ctx.store.getChild(input.childId)
    if (!child) throw new NotFoundError('Child not found.')

    await verifyChildPin(ctx, this.hasher, child, input)

    const token = this.mintChildToken({ childId: child.id, parentId: child.parentId })

    return { child: toChildAuthProfile(child), token }
  }
}
