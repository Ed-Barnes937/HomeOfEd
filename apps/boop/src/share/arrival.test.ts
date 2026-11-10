import { describe, expect, it } from 'vitest'

import { liveArrivalFragment } from './arrival.ts'

const arrival = { pathname: '/shared', hash: '#g=%7B%22a%22%3A1%7D' }

describe('liveArrivalFragment', () => {
  it('is the fragment as it arrived, even after the router has decoded the address bar', () => {
    expect(liveArrivalFragment(arrival, { pathname: '/shared', hash: '#g={%22a%22%3A1}' })).toBe(
      '#g=%7B%22a%22%3A1%7D',
    )
  })

  it('is empty once the fragment has been cleared', () => {
    expect(liveArrivalFragment(arrival, { pathname: '/shared', hash: '' })).toBe('')
  })

  it('is empty once the page has moved to another path', () => {
    expect(liveArrivalFragment(arrival, { pathname: '/', hash: '#g=abc' })).toBe('')
  })

  it('is empty outside a browser', () => {
    expect(liveArrivalFragment(null, { pathname: '/', hash: '#g=abc' })).toBe('')
  })
})
