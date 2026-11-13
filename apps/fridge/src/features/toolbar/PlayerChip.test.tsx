import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayerChip } from './PlayerChip.tsx'

afterEach(() => vi.unstubAllGlobals())

describe('PlayerChip', () => {
  it('in the estate, links to the account page alone, so a switch lands on hub home', () => {
    vi.stubGlobal('window', { location: { href: 'https://fridge.homeofed.com/' } })
    const html = renderToStaticMarkup(<PlayerChip name="Ada" />)
    expect(html).toContain('href="https://homeofed.com/account"')
    expect(html).not.toContain('returnTo')
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
