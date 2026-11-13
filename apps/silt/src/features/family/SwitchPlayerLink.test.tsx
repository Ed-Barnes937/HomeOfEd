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
const ACCOUNT = 'https://homeofed.com/account'

afterEach(() => vi.unstubAllGlobals())

describe('SwitchPlayerLink in the estate', () => {
  it('links the player circle to the account page alone, so a switch lands on hub home', () => {
    vi.stubGlobal('window', { location: { href: 'https://silt.homeofed.com/' } })
    const html = renderToStaticMarkup(
      <FamilySessionProvider session={ADA}>
        <SwitchPlayerLink />
      </FamilySessionProvider>,
    )
    expect(html).toContain(`href="${ACCOUNT}"`)
    expect(html).not.toContain('returnTo')
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })

  it('with no session, is an empty circle linking to the account page to choose who is playing', () => {
    vi.stubGlobal('window', { location: { href: 'https://silt.homeofed.com/' } })
    const html = renderToStaticMarkup(
      <FamilySessionProvider session={null}>
        <SwitchPlayerLink />
      </FamilySessionProvider>,
    )
    expect(html).toContain(`href="${ACCOUNT}"`)
    expect(html).not.toContain('returnTo')
    expect(html).toContain('aria-label="Choose who is playing"')
  })
})
