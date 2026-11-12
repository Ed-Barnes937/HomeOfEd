import { describe, expect, it } from 'vitest'

import { returnDestination, stillOnArrival } from './returnTo.ts'

const PROD = { allowLocal: false }

const query = (returnTo: string) => `?returnTo=${encodeURIComponent(returnTo)}`

describe('returnDestination', () => {
  it('is the vetted returnTo with the carried fragment reattached', () => {
    expect(returnDestination(query('https://boop.homeofed.com/play?bank=2'), '#g=abc', PROD)).toBe(
      'https://boop.homeofed.com/play?bank=2#g=abc',
    )
  })

  it('is the vetted returnTo alone when no fragment was carried', () => {
    expect(returnDestination(query('https://boop.homeofed.com'), '', PROD)).toBe(
      'https://boop.homeofed.com/',
    )
    expect(returnDestination(query('https://boop.homeofed.com/'), '#', PROD)).toBe(
      'https://boop.homeofed.com/',
    )
  })

  it('is null for anything safeReturnTo refuses, fragment or not', () => {
    expect(returnDestination('', '#g=abc', PROD)).toBeNull()
    expect(returnDestination(query('https://evil.example/'), '#g=abc', PROD)).toBeNull()
    expect(returnDestination(query('http://localhost:3008/'), '', PROD)).toBeNull()
  })

  it('is null when returnTo is given more than once, even if each would pass', () => {
    const twice = `${query('https://boop.homeofed.com/')}&${query('https://silt.homeofed.com/').slice(1)}`
    expect(returnDestination(twice, '#g=abc', PROD)).toBeNull()
  })

  // The fragment is attacker-controlled too: whatever it holds, it stays a fragment.
  it.each([
    ['@evil.example/', '#@evil.example/'],
    ['/../../account', '#/../../account'],
    ['\\\\evil.example', '#\\\\evil.example'],
    ['a second hash', '##//evil.example'],
    ['a newline and a scheme', '#\nhttps://evil.example/'],
    ['a query', '#?returnTo=https://evil.example/'],
  ])('a fragment holding %s cannot move the origin, path or query', (_name, fragment) => {
    const destination = returnDestination(
      query('https://boop.homeofed.com/play?bank=2'),
      fragment,
      PROD,
    )
    const url = new URL(destination!)
    expect(url.origin).toBe('https://boop.homeofed.com')
    expect(url.pathname).toBe('/play')
    expect(url.search).toBe('?bank=2')
  })

  it('passes the fragment through as opaque text', () => {
    expect(
      returnDestination(query('https://silt.homeofed.com/'), '#w=%7B%7D&x=a%20b/c?d', PROD),
    ).toBe('https://silt.homeofed.com/#w=%7B%7D&x=a%20b/c?d')
  })
})

describe('stillOnArrival', () => {
  const arrived = { pathname: '/account', search: query('https://boop.homeofed.com/') }

  it('holds while the address bar carries the same page and the same single returnTo', () => {
    expect(stillOnArrival(arrived, arrived)).toBe(true)
  })

  it('compares the path without trailing slashes, which the router strips on mount', () => {
    const slashed = { ...arrived, pathname: '/account/' }
    expect(stillOnArrival(slashed, arrived)).toBe(true)
    expect(stillOnArrival(arrived, slashed)).toBe(true)
  })

  it('ends once the visitor has moved to another page', () => {
    expect(stillOnArrival(arrived, { ...arrived, pathname: '/' })).toBe(false)
  })

  it('ends once the address bar carries no returnTo, or a different one', () => {
    expect(stillOnArrival(arrived, { ...arrived, search: '' })).toBe(false)
    expect(
      stillOnArrival(arrived, { ...arrived, search: query('https://silt.homeofed.com/') }),
    ).toBe(false)
  })

  it('never holds for an arrival without exactly one returnTo', () => {
    expect(
      stillOnArrival({ pathname: '/account', search: '' }, { pathname: '/account', search: '' }),
    ).toBe(false)
    const twice = `${query('https://boop.homeofed.com/')}&${query('https://boop.homeofed.com/').slice(1)}`
    const doubled = { pathname: '/account', search: twice }
    expect(stillOnArrival(doubled, doubled)).toBe(false)
  })
})
