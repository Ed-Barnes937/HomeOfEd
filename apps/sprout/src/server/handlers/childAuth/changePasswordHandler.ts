import {
  Handler,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type AppContext,
} from '@hoe/backend-kit'
import { z } from 'zod'

import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import { toChildAuthProfile, type ChildAuthProfile } from './schemas.ts'

// Minimum length for a child-chosen password. The only credential before this
// point is the username (the temp default), so any real password is an
// improvement; this just stops a trivially short one.
export const MIN_PASSWORD_LENGTH = 6

export const changePasswordInputSchema = z.object({
  childId: z.string().uuid(),
  newPassword: z.string(),
  password: z.string().optional(),
  pin: z.string().optional(),
  /** A fresh child-chosen PIN, set in the same step — the recovery path after
   * children.resetPin cleared the old one. */
  newPin: z.string().optional(),
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
    // A reset child (children.resetPin cleared the PIN) must leave this step
    // with BOTH credentials — a PIN-less but established child is a state
    // nothing else in the flow wants (ADR 0037).
    if (child.pinHash === null && input.newPin === undefined) {
      throw new ValidationError('Choose a 4-digit PIN.')
    }
    if (input.newPin !== undefined && !/^\d{4}$/.test(input.newPin)) {
      throw new ValidationError('PIN must be exactly 4 digits.')
    }

    const updated = await ctx.store.updateChild(child.id, {
      passwordHash: this.hasher.hash(input.newPassword),
      mustChangePassword: false,
      ...(input.newPin !== undefined && { pinHash: this.hasher.hash(input.newPin) }),
    })
    if (!updated) throw new NotFoundError('Child not found.')

    return { child: toChildAuthProfile(updated) }
  }
}
