import { describe, expect, it } from 'vitest'

import { returnDestination } from './returnTo.ts'

const PROD = { allowLocal: false }

describe('returnDestination', () => {
  it('is the vetted returnTo with the carried fragment reattached', () => {
    expect(returnDestination('https://boop.homeofed.com/play?bank=2', '#g=abc', PROD)).toBe(
      'https://boop.homeofed.com/play?bank=2#g=abc',
    )
  })

  it('is the vetted returnTo alone when no fragment was carried', () => {
    expect(returnDestination('https://boop.homeofed.com', '', PROD)).toBe(
      'https://boop.homeofed.com/',
    )
    expect(returnDestination('https://boop.homeofed.com/', '#', PROD)).toBe(
      'https://boop.homeofed.com/',
    )
  })

  it('is null for anything safeReturnTo refuses, fragment or not', () => {
    expect(returnDestination(null, '#g=abc', PROD)).toBeNull()
    expect(returnDestination('https://evil.example/', '#g=abc', PROD)).toBeNull()
    expect(returnDestination('http://localhost:3008/', '', PROD)).toBeNull()
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
    const destination = returnDestination('https://boop.homeofed.com/play?bank=2', fragment, PROD)
    const url = new URL(destination!)
    expect(url.origin).toBe('https://boop.homeofed.com')
    expect(url.pathname).toBe('/play')
    expect(url.search).toBe('?bank=2')
  })

  it('passes the fragment through as opaque text', () => {
    expect(returnDestination('https://silt.homeofed.com/', '#w=a%20b&x=%7B%7D/c?d', PROD)).toBe(
      'https://silt.homeofed.com/#w=a%20b&x=%7B%7D/c?d',
    )
  })
})
