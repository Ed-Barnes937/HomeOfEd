import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayerChip } from './PlayerChip.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('PlayerChip', () => {
  it('in the estate, links to hub to switch player and come back here', () => {
    vi.stubGlobal('window', { location: { href: 'https://fridge.homeofed.com/' } })
    const html = renderToStaticMarkup(<PlayerChip name="Ada" />)
    expect(html).toContain(
      'href="https://homeofed.com/account?returnTo=https%3A%2F%2Ffridge.homeofed.com%2F"',
    )
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
