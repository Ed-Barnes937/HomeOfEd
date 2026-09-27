import { ForbiddenError, UnauthorizedError, type AppContext } from '@hoe/backend-kit'

import { evaluatePinAttempt, recordEvent } from '../../behavioural-limits.ts'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'

type ChildRow = NonNullable<Awaited<ReturnType<SproutStore['getChild']>>>

/**
 * The PIN check both PIN logins share. Brute-force lockout: `evaluatePinAttempt`
 * counts recent `pin_fail` events for this child; once the window's limit is
 * hit, further attempts are rejected without even checking the submitted PIN.
 * A wrong PIN records a `pin_fail` event (feeding that lockout) before failing.
 */
export async function verifyChildPin(
  ctx: AppContext<SproutStore>,
  hasher: PasswordHasher,
  child: ChildRow,
  input: { pin: string; deviceToken: string },
): Promise<void> {
  const verdict = await evaluatePinAttempt(ctx.store, { childId: child.id }, () => ctx.now())
  if (verdict.locked) {
    throw new ForbiddenError('Too many incorrect PIN attempts. Please try again later.')
  }

  if (!child.pinHash || !hasher.verify(input.pin, child.pinHash)) {
    await recordEvent(ctx.store, {
      kind: 'pin_fail',
      childId: child.id,
      deviceToken: input.deviceToken,
    })
    throw new UnauthorizedError('Incorrect PIN.')
  }
}
