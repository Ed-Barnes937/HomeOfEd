import { describe, expect, it } from 'vitest'

import type { ChildSession } from '../../lib/childSession.ts'
import { establishChildSession, type ChildSessionEffects } from './childAuth.ts'

const profile: ChildSession = {
  id: 'c1',
  displayName: 'Kid',
  username: 'kid',
  presetName: 'early-learner',
  parentId: 'p1',
}

function trackedEffects() {
  const calls: string[] = []
  const effects: ChildSessionEffects = {
    signOutParent: () => {
      calls.push('signOut')
      return Promise.resolve()
    },
    setCookie: (token) => calls.push(`cookie:${token}`),
    setProfile: (p) => calls.push(`profile:${p.id}`),
  }
  return { calls, effects }
}

describe('establishChildSession', () => {
  // One identity per browser: a co-resident parent Better Auth session would
  // shadow the child on every child-scoped tRPC call (the auth seam gives parent
  // precedence), 401ing children.myConfig / conversations.*. So the parent MUST
  // be signed out before the child cookie is set.
  it('signs the co-resident parent out before setting the child session', async () => {
    const { calls, effects } = trackedEffects()
    await establishChildSession(profile, 'tok', effects)
    expect(calls).toEqual(['signOut', 'cookie:tok', 'profile:c1'])
  })

  it('skips the cookie when no token is provided (post password-change path)', async () => {
    const { calls, effects } = trackedEffects()
    await establishChildSession(profile, undefined, effects)
    expect(calls).toEqual(['signOut', 'profile:c1'])
  })
})
