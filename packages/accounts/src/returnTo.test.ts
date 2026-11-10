import { describe, expect, it } from 'vitest'

import {
  accountUrl,
  accountUrlFor,
  hubUrlFor,
  safeReturnTo,
  sharedUrl,
  switchPlayerUrlFor,
} from './returnTo.ts'

describe('safeReturnTo accepts an estate app origin', () => {
  it('accepts a production app URL and normalises it', () => {
    expect(safeReturnTo('https://boop.homeofed.com', { allowLocal: false })).toBe(
      'https://boop.homeofed.com/',
    )
    expect(safeReturnTo('https://armoury.homeofed.com/shop?x=1', { allowLocal: false })).toBe(
      'https://armoury.homeofed.com/shop?x=1',
    )
  })

  it('accepts every gated app and no other subdomain', () => {
    for (const id of ['boids', 'fridge', 'wotd', 'espy', 'karesansui', 'boop', 'silt', 'armoury'])
      expect(safeReturnTo(`https://${id}.homeofed.com/`, { allowLocal: false })).not.toBeNull()
    for (const id of ['family', 'sprout', 'sprout-pipeline', 'www'])
      expect(safeReturnTo(`https://${id}.homeofed.com/`, { allowLocal: false })).toBeNull()
  })

  it('drops the fragment, because hub reattaches the one the browser carried', () => {
    expect(safeReturnTo('https://boop.homeofed.com/#g=abc', { allowLocal: false })).toBe(
      'https://boop.homeofed.com/',
    )
  })

  it('accepts localhost dev and compose ports only when allowLocal', () => {
    expect(safeReturnTo('http://localhost:3008/', { allowLocal: true })).toBe(
      'http://localhost:3008/',
    )
    expect(safeReturnTo('http://localhost:8091/x', { allowLocal: true })).toBe(
      'http://localhost:8091/x',
    )
    expect(safeReturnTo('http://localhost:3008/', { allowLocal: false })).toBeNull()
    expect(safeReturnTo('http://localhost:8091/', { allowLocal: false })).toBeNull()
  })
})

describe('safeReturnTo refuses hostile input', () => {
  const hostile: Record<string, unknown> = {
    null: null,
    undefined: undefined,
    'a non-string': 42,
    'the empty string': '',
    'a relative path': '/account',
    'a bare host': 'boop.homeofed.com',
    'an unlisted origin': 'https://evil.example/',
    'a lookalike suffix host': 'https://boop.homeofed.com.evil.example/',
    'a lookalike prefix host': 'https://evilboop.homeofed.com/',
    'the apex (hub is not gated)': 'https://homeofed.com/',
    'http in production': 'http://boop.homeofed.com/',
    'a non-default port': 'https://boop.homeofed.com:8443/',
    'an explicit default port': 'https://boop.homeofed.com:443/',
    'a trailing-dot host': 'https://boop.homeofed.com./',
    'an upper-case host': 'https://BOOP.homeofed.com/',
    'userinfo pointing elsewhere': 'https://boop.homeofed.com@evil.example/',
    'userinfo on an allowed host': 'https://user:pass@boop.homeofed.com/',
    'an empty userinfo': 'https://@boop.homeofed.com/',
    'a javascript: URL': 'javascript:alert(1)',
    'a javascript: URL dressed with the host': 'javascript://boop.homeofed.com/%0aalert(1)',
    'a data: URL': 'data:text/html,<script>alert(1)</script>',
    'a ws: URL': 'wss://boop.homeofed.com/',
    'a protocol-relative URL': '//boop.homeofed.com/',
    'a protocol-relative URL elsewhere': '//evil.example/',
    'a backslash protocol-relative URL': '\\\\evil.example/',
    'a slash-backslash URL': '/\\evil.example/',
    'a scheme with backslashes': 'https:\\\\boop.homeofed.com/',
    'a backslash after the host': 'https://boop.homeofed.com\\@evil.example/',
    'a scheme without slashes': 'https:boop.homeofed.com/',
    'a triple slash': 'https:///boop.homeofed.com/',
    'leading whitespace': ' https://boop.homeofed.com/',
    'an embedded tab': 'https://boop.home\tofed.com/',
    'an embedded newline': 'https://boop.homeofed.com/\n',
    'a percent-encoded dot in the host': 'https://boop.homeofed.com%2eevil.example/',
    'a lookalike unicode host': 'https://bооp.homeofed.com/',
    'a fragment carrying the host': 'https://evil.example/#@boop.homeofed.com',
    'a query carrying the host': 'https://evil.example/?@boop.homeofed.com',
    '127.0.0.1 even when local': 'http://127.0.0.1:3008/',
    'an unlisted localhost port even when local': 'http://localhost:9999/',
    'hub dev port even when local': 'http://localhost:3000/',
    'https localhost even when local': 'https://localhost:3008/',
  }

  for (const [name, raw] of Object.entries(hostile)) {
    it(`refuses ${name}`, () => {
      expect(safeReturnTo(raw as string, { allowLocal: false })).toBeNull()
      expect(safeReturnTo(raw as string, { allowLocal: true })).toBeNull()
    })
  }
})

describe('sharedUrl', () => {
  const prod = { allowLocal: false }
  const local = { allowLocal: true }

  it("is the return URL's origin, /shared, and the fragment verbatim", () => {
    expect(sharedUrl('https://boop.homeofed.com/some/path?x=1', '#g=AbC-_%20', prod)).toBe(
      'https://boop.homeofed.com/shared#g=AbC-_%20',
    )
    expect(sharedUrl('http://localhost:3008/', '#w=1', local)).toBe(
      'http://localhost:3008/shared#w=1',
    )
  })

  it('accepts a fragment with or without its #', () => {
    expect(sharedUrl('https://armoury.homeofed.com/', 'w=1', prod)).toBe(
      'https://armoury.homeofed.com/shared#w=1',
    )
    expect(sharedUrl('https://armoury.homeofed.com/', '', prod)).toBe(
      'https://armoury.homeofed.com/shared',
    )
  })

  it('is null for a return URL safeReturnTo refuses, so an unvetted caller cannot leave the estate', () => {
    for (const returnTo of [
      'blob:https://evil.example/x',
      'blob:https://boop.homeofed.com/x',
      'https://evil.example/',
      'https://boop.homeofed.com@evil.example/',
      '//evil.example/',
    ])
      expect(sharedUrl(returnTo, '#g=1', local)).toBeNull()
    expect(sharedUrl('http://localhost:3008/', '#g=1', prod)).toBeNull()
  })
})

describe('accountUrlFor', () => {
  it('sends a production app to production hub', () => {
    expect(accountUrlFor('https://boop.homeofed.com/play#g=1')).toBe(
      'https://homeofed.com/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2Fplay#g=1',
    )
  })

  it("sends an app's dev server to hub's dev server", () => {
    expect(accountUrlFor('http://localhost:3008/')).toBe(
      'http://localhost:3000/account?returnTo=http%3A%2F%2Flocalhost%3A3008%2F',
    )
  })

  it("sends an app's compose port to hub's compose port", () => {
    expect(accountUrlFor('http://localhost:8091/x')).toBe(
      'http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8091%2Fx',
    )
  })

  it('is null anywhere that is not an estate app', () => {
    for (const href of [
      'capacitor://localhost/',
      'https://localhost/',
      'http://localhost/',
      'http://localhost:9999/',
      'http://127.0.0.1:3008/',
      'https://localhost:3008/',
      'http://boop.homeofed.com/',
      'https://homeofed.com/',
      'https://evil.example/',
      'not a url',
    ])
      expect(accountUrlFor(href)).toBeNull()
  })

  it('is null for any href whose returnTo safeReturnTo would refuse', () => {
    for (const href of [
      'https://BOOP.homeofed.com/',
      'https://boop.homeofed.com:443/x',
      'blob:https://boop.homeofed.com/x',
      'blob:http://localhost:3008/x',
    ])
      expect(accountUrlFor(href)).toBeNull()
  })

  it('always produces a returnTo that safeReturnTo accepts', () => {
    for (const [href, allowLocal] of [
      ['https://boop.homeofed.com', false],
      ['https://silt.homeofed.com/a/../b?x=1#s=2', false],
      ['http://localhost:3009/#g=1', true],
    ] as const) {
      const returnTo = new URL(accountUrlFor(href) ?? '').searchParams.get('returnTo')
      expect(safeReturnTo(returnTo, { allowLocal })).toBe(returnTo)
    }
  })
})

describe('accountUrl', () => {
  it('puts the return URL in the returnTo query parameter', () => {
    const href = accountUrl('https://homeofed.com/account', 'https://boop.homeofed.com/a?b=1&c=2')
    expect(href).toBe(
      'https://homeofed.com/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2Fa%3Fb%3D1%26c%3D2',
    )
    expect(new URL(href).searchParams.get('returnTo')).toBe('https://boop.homeofed.com/a?b=1&c=2')
  })

  it('moves a fragment onto the account URL, the same place a gate redirect leaves it', () => {
    expect(accountUrl('https://homeofed.com/account', 'https://boop.homeofed.com/#g=xyz')).toBe(
      'https://homeofed.com/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2F#g=xyz',
    )
  })

  it('leaves no fragment inside returnTo, and drops any fragment the account base had', () => {
    const href = accountUrl('https://homeofed.com/account#old', 'https://boop.homeofed.com/x#g=1')
    expect(new URL(href).searchParams.get('returnTo')).toBe('https://boop.homeofed.com/x')
    expect(new URL(href).hash).toBe('#g=1')
    expect(accountUrl('https://homeofed.com/account#old', 'https://boop.homeofed.com/')).toBe(
      'https://homeofed.com/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2F',
    )
  })

  it('keeps a query the account base already has', () => {
    expect(accountUrl('http://localhost:3000/account?x=1', 'http://localhost:3008/')).toBe(
      'http://localhost:3000/account?x=1&returnTo=http%3A%2F%2Flocalhost%3A3008%2F',
    )
  })
})

describe('hubUrlFor', () => {
  it.each([
    ['production', 'https://boop.homeofed.com/play', 'https://homeofed.com'],
    ['a dev server', 'http://localhost:3008/', 'http://localhost:3000'],
    ['the docker stack', 'http://localhost:8088/shared#g=1', 'http://localhost:8080'],
    ['a host outside the estate', 'https://hoe-boop.fly.dev/', 'https://homeofed.com'],
    ['an unparseable href', 'not a url', 'https://homeofed.com'],
  ])('is the hub beside an app on %s', (_tier, href, hub) => {
    expect(hubUrlFor(href)).toBe(hub)
  })
})

describe('switchPlayerUrlFor', () => {
  it('returns to where the player is, without the fragment', () => {
    expect(switchPlayerUrlFor('http://localhost:8088/?x=1#g=1')).toBe(
      'http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8088%2F%3Fx%3D1',
    )
  })

  it('is null outside the estate', () => {
    expect(switchPlayerUrlFor('https://hoe-boop.fly.dev/')).toBeNull()
  })
})
