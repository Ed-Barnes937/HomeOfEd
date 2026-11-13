import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayerLink } from './PlayerLink.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('PlayerLink', () => {
  it('in the estate, links to the account page alone, so a switch lands on hub home', () => {
    vi.stubGlobal('window', { location: { href: 'https://karesansui.homeofed.com/' } })
    const html = renderToStaticMarkup(<PlayerLink name="Ada" />)
    expect(html).toContain('href="https://homeofed.com/account"')
    expect(html).not.toContain('returnTo')
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
