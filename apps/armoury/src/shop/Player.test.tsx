import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Player } from './Header.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('Player', () => {
  it('in the estate, links to hub to switch player and come back here', () => {
    vi.stubGlobal('window', { location: { href: 'https://armoury.homeofed.com/wands' } })
    const html = renderToStaticMarkup(<Player name="Ada" />)
    expect(html).toContain(
      'href="https://homeofed.com/account?returnTo=https%3A%2F%2Farmoury.homeofed.com%2Fwands"',
    )
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
