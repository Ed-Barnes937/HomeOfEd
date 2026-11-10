import { describe, expect, it } from 'vitest'

import { familyUrl } from './familyUrl.ts'

describe('familyUrl', () => {
  it('talks to the local dev service from a local hostname', () => {
    expect(familyUrl('localhost', '3008')).toBe('http://localhost:3012')
    expect(familyUrl('127.0.0.1', '3008')).toBe('http://localhost:3012')
  })

  it("talks to the docker stack's family from boop's compose port", () => {
    expect(familyUrl('localhost', '8088')).toBe('http://localhost:8092')
  })

  it('talks to production from anywhere else, whatever the port', () => {
    expect(familyUrl('boop.homeofed.com', '')).toBe('https://family.homeofed.com')
    expect(familyUrl('hoe-boop.fly.dev', '8088')).toBe('https://family.homeofed.com')
  })
})
