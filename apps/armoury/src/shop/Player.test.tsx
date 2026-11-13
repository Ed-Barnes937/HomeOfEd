import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Player } from './Header.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('Player', () => {
  it('in the estate, links to the account page alone, so a switch lands on hub home', () => {
    vi.stubGlobal('window', { location: { href: 'https://armoury.homeofed.com/wands' } })
    const html = renderToStaticMarkup(<Player name="Ada" />)
    expect(html).toContain('href="https://homeofed.com/account"')
    expect(html).not.toContain('returnTo')
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
