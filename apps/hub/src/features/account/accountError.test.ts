import { FamilyClientError } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { accountErrorMessage } from './accountError.ts'

const FALLBACK = 'Something went wrong. Please try again.'

describe('accountErrorMessage', () => {
  // The whole reason the CONFLICT is typed: a parent sees the real reason on
  // the form, not a crash and not a generic apology.
  it('shows the words the service meant a person to read', () => {
    expect(
      accountErrorMessage(
        new FamilyClientError('that username is already taken', 'CONFLICT'),
        FALLBACK,
      ),
    ).toBe('that username is already taken')
    expect(
      accountErrorMessage(
        new FamilyClientError('Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD'),
        FALLBACK,
      ),
    ).toBe('Invalid email or password')
  })

  // "family service request failed (502)" is not something to put on a screen.
  it('falls back for a failure with nothing a person can act on', () => {
    expect(
      accountErrorMessage(
        new FamilyClientError('family service request failed (502)', 'INTERNAL_SERVER_ERROR'),
        FALLBACK,
      ),
    ).toBe(FALLBACK)
  })

  it('falls back for anything that is not a family-service refusal', () => {
    expect(accountErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK)
    expect(accountErrorMessage('nope', FALLBACK)).toBe(FALLBACK)
    expect(accountErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
  })
})
