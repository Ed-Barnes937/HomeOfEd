import { FamilyClientError } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { accountErrorMessage, isRateLimited } from './accountError.ts'

const FALLBACK = 'Something went wrong. Please try again.'

const refusal = (message: string, code: string) =>
  accountErrorMessage(new FamilyClientError(message, code), FALLBACK)

describe('accountErrorMessage', () => {
  // The whole reason the CONFLICT is typed: a parent sees the real reason on
  // the form, not a crash and not a generic apology.
  it('shows the words the service meant a person to read', () => {
    expect(refusal('that username is already taken', 'CONFLICT')).toBe(
      'that username is already taken',
    )
    expect(refusal('Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD')).toBe(
      'Invalid email or password',
    )
    expect(refusal('A valid invite code is required to register.', 'FORBIDDEN')).toBe(
      'A valid invite code is required to register.',
    )
  })

  // "family service request failed (502)" is not something to put on a screen.
  it('falls back for a failure with nothing a person can act on', () => {
    expect(refusal('family service request failed (502)', 'INTERNAL_SERVER_ERROR')).toBe(FALLBACK)
  })

  /**
   * The real thing, captured from the live server: tRPC answers a parser failure
   * with the ZodError's own message. A 33-character nickname is a plausible first
   * action on this screen, and it used to put this on a parent's display.
   */
  it('never puts a stringified zod issue array on the screen', () => {
    const zodish = JSON.stringify(
      [
        {
          origin: 'string',
          code: 'too_big',
          maximum: 32,
          path: ['displayName'],
          message: 'Too big: expected string to have <=32 characters',
        },
      ],
      null,
      2,
    )
    expect(refusal(zodish, 'BAD_REQUEST')).toBe(FALLBACK)
  })

  // The CSRF guard's own sentence is addressed to whoever wrote the client.
  it('falls back for the content-type guard, whose message is for a developer', () => {
    expect(
      refusal('tRPC requests must be sent with content-type: application/json', 'UNSUPPORTED_MEDIA_TYPE'),
    ).toBe(FALLBACK)
  })

  /**
   * The code list can only name refusals somebody thought of. A future one
   * carrying JSON must still not reach the screen, which is why the shape of the
   * message is checked as well.
   */
  it('falls back for any message that opens as JSON, whatever code carried it', () => {
    expect(refusal('[{"code":"custom"}]', 'SOME_NEW_REFUSAL')).toBe(FALLBACK)
    expect(refusal('{"issues":[]}', 'CONFLICT')).toBe(FALLBACK)
    expect(refusal('   ', 'CONFLICT')).toBe(FALLBACK)
  })

  // Better Auth's 429 carries no code, so the client takes TOO_MANY_REQUESTS from the status.
  it("says a rate-limited try plainly, in house words rather than the service's", () => {
    expect(refusal('Too many requests. Please try again later.', 'TOO_MANY_REQUESTS')).toBe(
      'Too many tries. Wait a minute and try again.',
    )
  })

  it('knows a rate-limited refusal from every other failure', () => {
    expect(isRateLimited(new FamilyClientError('Too many requests.', 'TOO_MANY_REQUESTS'))).toBe(
      true,
    )
    expect(
      isRateLimited(
        new FamilyClientError('Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD'),
      ),
    ).toBe(false)
    expect(isRateLimited(new TypeError('Failed to fetch'))).toBe(false)
    expect(isRateLimited(undefined)).toBe(false)
  })

  it('falls back for anything that is not a family-service refusal', () => {
    expect(accountErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK)
    expect(accountErrorMessage('nope', FALLBACK)).toBe(FALLBACK)
    expect(accountErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
  })
})
