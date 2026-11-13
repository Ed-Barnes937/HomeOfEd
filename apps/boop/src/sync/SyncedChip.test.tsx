import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SyncedChip } from './SyncedChip.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('SyncedChip', () => {
  it('in the estate, links to hub to switch player and come back here', () => {
    vi.stubGlobal('window', { location: { href: 'https://boop.homeofed.com/' } })
    const html = renderToStaticMarkup(<SyncedChip name="Ada" />)
    expect(html).toContain(
      'href="https://homeofed.com/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2F"',
    )
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
