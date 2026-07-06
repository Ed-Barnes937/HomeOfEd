import { Handler, UnauthorizedError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import type { PresetName } from '../../domain/presets.ts'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import type { ChildAuthProfile } from './schemas.ts'

export const loginPasswordInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceToken: z.string().min(1),
})
export type LoginPasswordInput = z.infer<typeof loginPasswordInputSchema>

export interface LoginPasswordResult {
  child: ChildAuthProfile
  /** Signed child-session token (auth/childToken.ts). Setting it as the
   * CHILD_SESSION_COOKIE is a P5/transport concern — this handler only mints
   * it. */
  token: string
}

export interface LoginPasswordDeps {
  /** Injected at the composition root (scrypt in Node, a fake in `.iwft`). */
  hasher: PasswordHasher
  /** Mints the signed child-session token (node:crypto + the dedicated secret
   * live behind this port — plan §5.2). Injected at the composition root. */
  mintChildToken: ChildTokenMinter
}

/**
 * childAuth.loginPassword — the device-login screen's username+password step.
 * PUBLIC: runs before any session exists, so identity comes entirely from the
 * input credentials, proven against the Store — never from `ctx.auth`. An
 * unknown username and a wrong password return the SAME generic error so a
 * failed login never leaks which field was wrong (source parity). On success,
 * registers the device (if new) and mints a signed child-session token.
 */
export class LoginPasswordHandler extends Handler<
  LoginPasswordInput,
  LoginPasswordResult,
  SproutStore
> {
  private readonly hasher: PasswordHasher
  private readonly mintChildToken: ChildTokenMinter

  constructor(deps: LoginPasswordDeps) {
    super()
    this.hasher = deps.hasher
    this.mintChildToken = deps.mintChildToken
  }

  async run(
    input: LoginPasswordInput,
    ctx: AppContext<SproutStore>,
  ): Promise<LoginPasswordResult> {
    const child = await ctx.store.getChildByUsername(input.username)
    if (!child || !this.hasher.verify(input.password, child.passwordHash)) {
      throw new UnauthorizedError('Invalid username or password.')
    }

    const existingDevice = await ctx.store.getDeviceByToken(input.deviceToken)
    if (!existingDevice) {
      await ctx.store.createDevice({ parentId: child.parentId, deviceToken: input.deviceToken })
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
