import {
  Handler,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type AppContext,
} from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '@hoe/sprout-shared'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import type { ChildAuthProfile } from './schemas.ts'

// Minimum length for a child-chosen password. The only credential before this
// point is the username (the temp default), so any real password is an
// improvement; this just stops a trivially short one.
export const MIN_PASSWORD_LENGTH = 6

export const changePasswordInputSchema = z.object({
  childId: z.string().uuid(),
  newPassword: z.string(),
  password: z.string().optional(),
  pin: z.string().optional(),
})
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>

export interface ChangePasswordResult {
  child: ChildAuthProfile
}

export interface ChangePasswordDeps {
  hasher: PasswordHasher
}

/**
 * childAuth.changePassword — the forced first-login password change. PUBLIC:
 * there is no child session token yet at this point in the flow, so identity
 * is proven with the credential the child just authenticated with — their
 * temp password (= username) OR their PIN — never from `ctx.auth`. Only
 * usable while `mustChangePassword` is set, so this can never overwrite an
 * established child's password. Source parity: does not mint a session token
 * (the child logs in normally via loginPassword/loginPin afterwards).
 */
export class ChangePasswordHandler extends Handler<
  ChangePasswordInput,
  ChangePasswordResult,
  SproutStore
> {
  private readonly hasher: PasswordHasher

  constructor(deps: ChangePasswordDeps) {
    super()
    this.hasher = deps.hasher
  }

  async run(
    input: ChangePasswordInput,
    ctx: AppContext<SproutStore>,
  ): Promise<ChangePasswordResult> {
    const child = await ctx.store.getChild(input.childId)
    if (!child) throw new NotFoundError('Child not found.')
    if (!child.mustChangePassword) {
      throw new ValidationError('Password has already been set.')
    }

    const provenByPassword =
      input.password !== undefined && this.hasher.verify(input.password, child.passwordHash)
    const provenByPin =
      input.pin !== undefined &&
      child.pinHash !== null &&
      this.hasher.verify(input.pin, child.pinHash)
    if (!provenByPassword && !provenByPin) {
      throw new UnauthorizedError("We couldn't verify it was you. Try again.")
    }

    if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    if (input.newPassword === child.username) {
      throw new ValidationError("Pick a password that isn't your username.")
    }

    const updated = await ctx.store.updateChild(child.id, {
      passwordHash: this.hasher.hash(input.newPassword),
      mustChangePassword: false,
    })
    if (!updated) throw new NotFoundError('Child not found.')

    return {
      child: {
        id: updated.id,
        displayName: updated.displayName,
        username: updated.username,
        presetName: updated.presetName as PresetName,
        parentId: updated.parentId,
        mustChangePassword: updated.mustChangePassword,
      },
    }
  }
}
