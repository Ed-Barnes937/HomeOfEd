import { describe, expect, it } from 'vitest'

import { hubUrl } from './hubUrl.ts'

describe('hubUrl', () => {
  it('points a prod subdomain at the apex hub', () => {
    expect(hubUrl('karesansui.homeofed.com')).toBe('https://homeofed.com')
  })

  it('points local dev at the hub dev server on port 3000', () => {
    expect(hubUrl('localhost')).toBe('http://localhost:3000')
    expect(hubUrl('127.0.0.1')).toBe('http://localhost:3000')
  })
})
