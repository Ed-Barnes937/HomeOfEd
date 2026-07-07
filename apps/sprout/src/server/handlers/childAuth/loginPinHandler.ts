import {
  ForbiddenError,
  Handler,
  NotFoundError,
  UnauthorizedError,
  type AppContext,
} from '@hoe/backend-kit'
import { z } from 'zod'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import { evaluatePinAttempt, recordEvent } from '../../behavioural-limits.ts'
import type { PresetName } from '@hoe/sprout-shared'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import type { ChildAuthProfile } from './schemas.ts'

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
 * PUBLIC (no session yet). Brute-force lockout: `evaluatePinAttempt` counts
 * recent `pin_fail` events for this child; once the window's limit is hit,
 * further attempts are rejected without even checking the submitted PIN. A
 * wrong PIN records a `pin_fail` event (feeding that lockout) before failing.
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

    const verdict = await evaluatePinAttempt(ctx.store, { childId: input.childId }, () => ctx.now())
    if (verdict.locked) {
      throw new ForbiddenError('Too many incorrect PIN attempts. Please try again later.')
    }

    if (!child.pinHash || !this.hasher.verify(input.pin, child.pinHash)) {
      await recordEvent(ctx.store, {
        kind: 'pin_fail',
        childId: input.childId,
        deviceToken: input.deviceToken,
      })
      throw new UnauthorizedError('Incorrect PIN.')
    }

    const token = this.mintChildToken({ childId: child.id, parentId: child.parentId })

    return {
      child: {
        id: child.id,
        displayName: child.displayName,
        username: child.username,
        presetName: child.presetName as PresetName,
        parentId: child.parentId,
        mustChangePassword: child.mustChangePassword,
      },
      token,
    }
  }
}
