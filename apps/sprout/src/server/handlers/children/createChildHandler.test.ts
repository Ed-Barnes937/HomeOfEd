import { UnauthorizedError, ValidationError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { scryptHasher, verifySecret } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { CreateChildHandler } from './createChildHandler.ts'

const fixedUsername = (): string => 'kid1234'
const deps = { hasher: scryptHasher, generateUsername: fixedUsername }

describe('CreateChildHandler', () => {
  it('creates the child, its preset, and calibration answers under the authed parent', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new CreateChildHandler(deps).run(
      {
        displayName: 'Kid',
        presetName: 'confident-reader',
        pin: '4321',
        sliderOverrides: { vocabularyLevel: 5 },
        calibrationAnswers: [{ questionId: 'babies', selectedLevel: 1, customAnswer: null }],
      },
      ctx,
    )

    expect(result.child).toMatchObject({ username: 'kid1234', displayName: 'Kid' })

    const child = await store.getChild(result.child.id)
    expect(child?.parentId).toBe('p1')
    expect(child?.mustChangePassword).toBe(true)
    // Temp password is the username; PIN is hashed (never stored plaintext).
    expect(verifySecret('kid1234', child?.passwordHash ?? '')).toBe(true)
    expect(verifySecret('4321', child?.pinHash ?? '')).toBe(true)

    const preset = await store.getPresetByChild(result.child.id)
    expect(preset?.name).toBe('confident-reader')
    expect(preset?.vocabularyLevel).toBe(5) // override applied over the preset default
    expect(preset?.responseDepth).toBe(3) // untouched preset default

    const answers = await store.listCalibrationAnswers(result.child.id)
    expect(answers).toHaveLength(1)
  })

  it('rejects a PIN that is not exactly 4 digits', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })
    await expect(
      new CreateChildHandler(deps).run(
        { displayName: 'Kid', presetName: 'early-learner', pin: '12' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects an anonymous caller', async () => {
    const ctx = makeCtx({ user: null })
    await expect(
      new CreateChildHandler(deps).run(
        { displayName: 'Kid', presetName: 'early-learner', pin: '1234' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('rejects a child caller (parent auth required)', async () => {
    const ctx = makeCtx({ user: childUser('c1', 'p1') })
    await expect(
      new CreateChildHandler(deps).run(
        { displayName: 'Kid', presetName: 'early-learner', pin: '1234' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })
})
