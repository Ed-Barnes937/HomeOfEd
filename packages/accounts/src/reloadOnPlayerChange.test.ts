import { describe, expect, it } from 'vitest'

import { reloadOnPlayerChange } from './reloadOnPlayerChange.ts'

function page(initial: string | null) {
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  let player = initial
  let reloads = 0
  const stop = reloadOnPlayerChange(initial, {
    window: win,
    document: doc,
    current: () => player,
    reload: () => reloads++,
  })
  return {
    win,
    doc,
    stop,
    switchTo: (next: string | null) => (player = next),
    reloads: () => reloads,
  }
}

describe('reloadOnPlayerChange', () => {
  it.each(['pageshow', 'focus'])('reloads on %s once another profile is signed in', (event) => {
    const tab = page('child-cy')
    tab.switchTo('child-bo')
    tab.win.dispatchEvent(new Event(event))

    expect(tab.reloads()).toBe(1)
  })

  it('reloads when the tab becomes visible again, not when it is hidden', () => {
    const tab = page('child-cy')
    tab.switchTo('child-bo')
    tab.doc.visibilityState = 'hidden'
    tab.doc.dispatchEvent(new Event('visibilitychange'))
    expect(tab.reloads()).toBe(0)

    tab.doc.visibilityState = 'visible'
    tab.doc.dispatchEvent(new Event('visibilitychange'))
    expect(tab.reloads()).toBe(1)
  })

  it.each([
    ['signing out', 'child-cy', null],
    ['signing in', null, 'child-cy'],
  ])('reloads on %s too', (_change, from, to) => {
    const tab = page(from)
    tab.switchTo(to)
    tab.win.dispatchEvent(new Event('focus'))

    expect(tab.reloads()).toBe(1)
  })

  it('leaves the page alone while the same profile is playing', () => {
    const tab = page('child-cy')
    tab.win.dispatchEvent(new Event('pageshow'))
    tab.win.dispatchEvent(new Event('focus'))

    expect(tab.reloads()).toBe(0)
  })

  it('stops watching when asked', () => {
    const tab = page('child-cy')
    tab.stop()
    tab.switchTo('child-bo')
    tab.win.dispatchEvent(new Event('focus'))

    expect(tab.reloads()).toBe(0)
  })
})
