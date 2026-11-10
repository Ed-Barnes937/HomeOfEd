import { describe, expect, it } from 'vitest'

import { familySessionCookieOptions, familyUrl, returnToOptions } from './familyService.ts'

describe('familyUrl', () => {
  it('talks to the local service from a local hostname', () => {
    expect(familyUrl('localhost')).toBe('http://localhost:3012')
    expect(familyUrl('127.0.0.1')).toBe('http://localhost:3012')
  })

  it('talks to production from anywhere else', () => {
    expect(familyUrl('homeofed.com')).toBe('https://family.homeofed.com')
    expect(familyUrl('hoe-hub.fly.dev')).toBe('https://family.homeofed.com')
  })
})

describe('returnToOptions', () => {
  it('allows localhost app origins only while hub is on a local hostname', () => {
    expect(returnToOptions('localhost')).toEqual({ allowLocal: true })
    expect(returnToOptions('127.0.0.1')).toEqual({ allowLocal: true })
    expect(returnToOptions('homeofed.com')).toEqual({ allowLocal: false })
    expect(returnToOptions('hoe-hub.fly.dev')).toEqual({ allowLocal: false })
  })
})

describe('familySessionCookieOptions', () => {
  // The estate-wide cookie is the point: boop on its own subdomain has to read
  // what hub wrote on the apex.
  it('scopes the cookie to the whole estate in production', () => {
    expect(familySessionCookieOptions('homeofed.com')).toEqual({
      domain: '.homeofed.com',
      secure: true,
    })
  })

  // A browser refuses `Domain=.homeofed.com` from localhost outright, so the
  // dev and .iwft cookie is host-scoped and plain.
  it('sets neither Domain nor Secure on a local hostname', () => {
    expect(familySessionCookieOptions('localhost')).toEqual({})
    expect(familySessionCookieOptions('127.0.0.1')).toEqual({})
  })
})
