import { Handler, type AppContext } from '@hoe/backend-kit'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import { loginPinInputSchema, type LoginPinInput, type LoginPinResult } from './loginPinHandler.ts'
import { toChildAuthProfile } from './schemas.ts'
import { verifyChildPin } from './verifyChildPin.ts'

export const loginPinFromParentInputSchema = loginPinInputSchema

export interface LoginPinFromParentDeps {
  hasher: PasswordHasher
  mintChildToken: ChildTokenMinter
}

/**
 * childAuth.loginPinFromParent — a signed-in parent hands the device to their
 * child, who proves themselves with just their PIN. The parent session stands
 * in for the password: ownership is checked against `ctx.auth`, so this only
 * works for the parent's own child. Registers the device so the picker offers
 * the child next time, like a password login does.
 */
export class LoginPinFromParentHandler extends Handler<LoginPinInput, LoginPinResult, SproutStore> {
  private readonly hasher: PasswordHasher
  private readonly mintChildToken: ChildTokenMinter

  constructor(deps: LoginPinFromParentDeps) {
    super()
    this.hasher = deps.hasher
    this.mintChildToken = deps.mintChildToken
  }

  async run(input: LoginPinInput, ctx: AppContext<SproutStore>): Promise<LoginPinResult> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    await verifyChildPin(ctx, this.hasher, child, input)

    const existingDevice = await ctx.store.getDeviceByToken(input.deviceToken)
    if (!existingDevice) {
      await ctx.store.createDevice({ parentId: child.parentId, deviceToken: input.deviceToken })
    }

    const token = this.mintChildToken({ childId: child.id, parentId: child.parentId })

    return { child: toChildAuthProfile(child), token }
  }
}
