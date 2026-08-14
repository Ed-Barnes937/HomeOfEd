import { describe, expect, it } from 'vitest'

import { formatShortDate } from './formatDate.ts'

describe('formatShortDate', () => {
  it('formats a date as the design date line, e.g. "Tue 11 Aug"', () => {
    expect(formatShortDate(new Date('2026-08-11'))).toBe('Tue 11 Aug')
  })

  it('never pads the day with a leading zero', () => {
    expect(formatShortDate(new Date('2026-07-05'))).toBe('Sun 5 Jul')
  })
})
