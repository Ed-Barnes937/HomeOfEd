import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FamilySessionProvider } from './FamilySessionContext.tsx'
import { SwitchPlayerLink } from './SwitchPlayerLink.tsx'

const ADA = {
  sub: 'child-ada',
  role: 'child',
  parentId: 'parent-1',
  name: 'Ada',
  iat: 0,
  exp: 1,
} as const
const HUB = 'https://homeofed.com/account?returnTo=https%3A%2F%2Fsilt.homeofed.com%2F'

afterEach(() => vi.unstubAllGlobals())

describe('SwitchPlayerLink in the estate', () => {
  it('links the player circle to hub to switch player and come back here', () => {
    vi.stubGlobal('window', { location: { href: 'https://silt.homeofed.com/' } })
    const html = renderToStaticMarkup(
      <FamilySessionProvider session={ADA}>
        <SwitchPlayerLink />
      </FamilySessionProvider>,
    )
    expect(html).toContain(`href="${HUB}"`)
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })

  it('with no session, is an empty circle to choose who is playing', () => {
    vi.stubGlobal('window', { location: { href: 'https://silt.homeofed.com/' } })
    const html = renderToStaticMarkup(
      <FamilySessionProvider session={null}>
        <SwitchPlayerLink />
      </FamilySessionProvider>,
    )
    expect(html).toContain(`href="${HUB}"`)
    expect(html).toContain('aria-label="Choose who is playing"')
  })
})
