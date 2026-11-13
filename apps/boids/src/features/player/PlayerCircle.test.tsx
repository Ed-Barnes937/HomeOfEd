import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FamilySessionProvider } from './FamilySessionContext.tsx'
import { PlayerCircle } from './PlayerCircle.tsx'

const ADA = {
  sub: 'child-ada',
  role: 'child',
  parentId: 'parent-1',
  name: 'Ada',
  iat: 0,
  exp: 1,
} as const

afterEach(() => vi.unstubAllGlobals())

describe('PlayerCircle', () => {
  it('in the estate, links to hub to switch player and come back here', () => {
    vi.stubGlobal('window', { location: { href: 'https://boids.homeofed.com/' } })
    const html = renderToStaticMarkup(
      <FamilySessionProvider session={ADA}>
        <PlayerCircle />
      </FamilySessionProvider>,
    )
    expect(html).toContain(
      'href="https://homeofed.com/account?returnTo=https%3A%2F%2Fboids.homeofed.com%2F"',
    )
    expect(html).toContain('aria-label="Playing as Ada. Switch player"')
  })
})
