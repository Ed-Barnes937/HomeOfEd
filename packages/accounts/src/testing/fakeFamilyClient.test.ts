import { describe, expect, it } from 'vitest'

import { readFamilySession } from '../readFamilySession.ts'
import { MAX_ACCOUNT_BYTES, MAX_ACCOUNT_SLOTS, MAX_SLOT_BYTES } from '../saveLimits.ts'

import { FakeFamilyClient, type FakeSessionInput } from './fakeFamilyClient.ts'

const now = () => new Date('2026-01-01T00:00:00Z')

const signedIn = () => {
  const client = new FakeFamilyClient({ now })
  client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
  return client
}

describe('FakeFamilyClient (save contract)', () => {
  it('round-trips a put through get, versioning server-side', async () => {
    const client = signedIn()
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()

    const first = await client.put({ appId: 'boop', slotKey: 'boop:save', blob: '{"a":1}' })
    expect(first).toEqual({ version: 1 })

    const got = await client.get({ appId: 'boop', slotKey: 'boop:save' })
    expect(got).toEqual({ blob: '{"a":1}', version: 1, updatedAt: now().getTime() })

    // An unconditional overwrite bumps the version.
    const second = await client.put({ appId: 'boop', slotKey: 'boop:save', blob: '{"a":2}' })
    expect(second).toEqual({ version: 2 })
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('{"a":2}')
  })

  it('lists slot metadata without blobs, scoped to the appId', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'héllo' })
    await client.put({ appId: 'silt', slotKey: 'silt:scene:1', blob: 'x' })

    const slots = await client.list({ appId: 'boop' })
    expect(slots).toEqual([
      {
        slotKey: 'boop:save',
        version: 1,
        // sizeBytes is UTF-8 bytes, not code units: é is 2 bytes.
        sizeBytes: 6,
        updatedAt: now().getTime(),
      },
    ])
  })

  it('deletes a slot', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
    await client.delete({ appId: 'boop', slotKey: 'boop:save' })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
    expect(await client.list({ appId: 'boop' })).toEqual([])
  })

  it('scopes saves per account - switching profile switches the data', async () => {
    const client = new FakeFamilyClient({ now })
    client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'robins' })

    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()

    client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('robins')
  })

  it('rejects every call when signed out, like the real router', async () => {
    const client = new FakeFamilyClient({ now })
    await expect(client.get({ appId: 'boop', slotKey: 'boop:save' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    client.clearTokenSession()
    await expect(client.put({ appId: 'boop', slotKey: 'k', blob: 'x' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('failWith makes every call reject (offline degradation) until cleared', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })

    client.failWith(new Error('service unreachable'))
    await expect(client.get({ appId: 'boop', slotKey: 'boop:save' })).rejects.toThrow(
      'service unreachable',
    )
    await expect(client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'y' })).rejects.toThrow()

    client.failWith(null)
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('x')
  })

  it('exposes the active session for harness assertions', () => {
    const client = new FakeFamilyClient({ now })
    expect(client.activeSession()).toBeNull()
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    expect(client.activeSession()?.sub).toBe('parent-1')
  })
})

const INVITE = 'let-me-in'

const CREDENTIALS = { name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery' }

function withParent(): FakeFamilyClient {
  return new FakeFamilyClient({ now, inviteCode: INVITE, parents: [CREDENTIALS] })
}

/**
 * The fake keeps the two credentials apart exactly as the service does (ADR
 * 0078/0079): a parent cookie session authorises identity and nothing else, and
 * a family token authorises saves and nothing else.
 */
describe('FakeFamilyClient (identity contract)', () => {
  it('refuses every identity call with no parent session', async () => {
    const client = withParent()
    await expect(client.me()).resolves.toEqual({ parent: null })
    await expect(client.listChildren()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      client.addChild({ username: 'robin', displayName: 'Robin' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(client.mintSessionToken({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(client.deleteAccount()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('a family token is not a parent session', async () => {
    const client = withParent()
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    await expect(client.listChildren()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('a parent session is not a family token', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    await expect(client.get({ appId: 'boop', slotKey: 'boop:save' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('registers behind the invite code and signs the parent straight in', async () => {
    const client = new FakeFamilyClient({ now, inviteCode: INVITE })

    await expect(client.signUp({ ...CREDENTIALS, inviteCode: 'guessed' })).rejects.toMatchObject({
      message: 'A valid invite code is required to register.',
    })
    await expect(client.me()).resolves.toEqual({ parent: null })

    await client.signUp({ ...CREDENTIALS, inviteCode: INVITE })
    expect((await client.me()).parent).toMatchObject({ name: 'Ada', email: 'ada@example.com' })
  })

  it('refuses a second registration of the same email', async () => {
    const client = withParent()
    await expect(client.signUp({ ...CREDENTIALS, inviteCode: INVITE })).rejects.toMatchObject({
      code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
    })
  })

  it('signs in with the right password only, and signs out again', async () => {
    const client = withParent()

    await expect(
      client.signIn({ email: CREDENTIALS.email, password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' })

    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    expect((await client.me()).parent?.email).toBe(CREDENTIALS.email)

    await client.signOut()
    expect((await client.me()).parent).toBeNull()
  })

  /**
   * Better Auth's default rule for /sign-in and /sign-up, checked against the
   * real image: three tries per route in ten seconds, right or wrong, then 429
   * until ten seconds after the last try it let through.
   */
  it('rate-limits sign-in and sign-up per route, as Better Auth does', async () => {
    let ms = Date.parse('2026-01-01T00:00:00Z')
    const client = new FakeFamilyClient({
      now: () => new Date(ms),
      inviteCode: INVITE,
      parents: [CREDENTIALS],
    })
    const right = { email: CREDENTIALS.email, password: CREDENTIALS.password }
    const wrong = { email: CREDENTIALS.email, password: 'wrong' }
    const tooMany = {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please try again later.',
    }

    for (let i = 0; i < 3; i += 1) {
      ms += 1_000
      await expect(client.signIn(wrong)).rejects.toMatchObject({
        code: 'INVALID_EMAIL_OR_PASSWORD',
      })
    }
    const lastLetThrough = ms
    ms += 1_000
    await expect(client.signIn(right)).rejects.toMatchObject(tooMany)
    await expect(client.me()).resolves.toEqual({ parent: null })

    await client.signUp({ ...CREDENTIALS, email: 'new@example.com', inviteCode: INVITE })
    await client.signOut()

    ms = lastLetThrough + 10_000
    await expect(client.signIn(right)).rejects.toMatchObject(tooMany)
    ms += 1
    await client.signIn(right)
    expect((await client.me()).parent?.email).toBe(CREDENTIALS.email)
  })

  it('adds, lists and renames child profiles', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })
    await client.addChild({ username: 'wren', displayName: 'Wren' })

    expect((await client.listChildren()).map((c) => c.username)).toEqual(['robin', 'wren'])

    const renamed = await client.renameChild({ id: robin.id, displayName: 'Bobbin' })
    expect(renamed.displayName).toBe('Bobbin')
    expect((await client.listChildren())[0]!.displayName).toBe('Bobbin')
  })

  it('lets two households each have a child with the same username', async () => {
    const client = new FakeFamilyClient({
      now,
      parents: [
        CREDENTIALS,
        { name: 'Grace', email: 'grace@example.com', password: 'correct-horse-battery' },
      ],
    })
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    await client.addChild({ username: 'robin', displayName: 'Robin' })
    await client.signIn({ email: 'grace@example.com', password: 'correct-horse-battery' })

    await expect(
      client.addChild({ username: 'robin', displayName: 'Robin' }),
    ).resolves.toMatchObject({
      username: 'robin',
    })
    expect((await client.listChildren()).map((c) => c.username)).toEqual(['robin'])
  })

  it('answers a username taken within the household with the typed CONFLICT the service uses', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    await client.addChild({ username: 'robin', displayName: 'Robin' })

    await expect(
      client.addChild({ username: 'robin', displayName: 'Robin II' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'that username is already taken' })
  })

  it('refuses to rename a profile this parent does not own', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    await expect(
      client.renameChild({ id: '11111111-2222-4333-8444-555555555555', displayName: 'Nope' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('changes a username, and refuses one another child in the household has', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robni', displayName: 'Robin' })
    await client.addChild({ username: 'wren', displayName: 'Wren' })

    await expect(
      client.renameChild({ id: robin.id, displayName: 'Robin', username: 'robin' }),
    ).resolves.toMatchObject({ id: robin.id, username: 'robin', displayName: 'Robin' })
    await expect(
      client.renameChild({ id: robin.id, displayName: 'Robin', username: 'robin' }),
    ).resolves.toMatchObject({ username: 'robin' })
    await expect(
      client.renameChild({ id: robin.id, displayName: 'Robin', username: 'wren' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'that username is already taken' })
    expect((await client.listChildren()).map((c) => c.username)).toEqual(['robin', 'wren'])
  })

  it('deletes one profile and its saves, and nothing else', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })
    const wren = await client.addChild({ username: 'wren', displayName: 'Wren' })
    for (const sub of [robin.id, wren.id]) {
      client.signInAs({ sub, role: 'child', parentId: 'p', name: 'x' })
      await client.put({ appId: 'boop', slotKey: 'boop:save', blob: sub })
    }

    await expect(client.deleteChild({ id: robin.id })).resolves.toEqual({ ok: true })

    expect((await client.listChildren()).map((c) => c.id)).toEqual([wren.id])
    client.signInAs({ sub: robin.id, role: 'child', parentId: 'p', name: 'x' })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
    client.signInAs({ sub: wren.id, role: 'child', parentId: 'p', name: 'x' })
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe(wren.id)
  })

  it('refuses to delete a profile of another household, or one that does not exist', async () => {
    const client = new FakeFamilyClient({
      now,
      parents: [
        CREDENTIALS,
        { name: 'Grace', email: 'grace@example.com', password: 'correct-horse-battery' },
      ],
    })
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })
    await client.signIn({ email: 'grace@example.com', password: 'correct-horse-battery' })

    await expect(client.deleteChild({ id: robin.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      client.deleteChild({ id: '11111111-2222-4333-8444-555555555555' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await client.signOut()
    await expect(client.deleteChild({ id: robin.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })

    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    expect(await client.listChildren()).toHaveLength(1)
  })

  it('mints a decodable token for the parent and for a child', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })

    const parentToken = (await client.mintSessionToken({})).token
    const childToken = (await client.mintSessionToken({ childId: robin.id })).token

    expect(readFamilySession({ cookie: `hoe_family_session=${parentToken}`, now })).toMatchObject({
      role: 'parent',
      name: 'Ada',
    })
    expect(readFamilySession({ cookie: `hoe_family_session=${childToken}`, now })).toMatchObject({
      sub: robin.id,
      role: 'child',
      name: 'Robin',
    })
  })

  it('erasing takes the profiles and every save row with it', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })

    client.signInAs({ sub: robin.id, role: 'child', parentId: 'p', name: 'Robin' })
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })

    await client.deleteAccount()

    expect((await client.me()).parent).toBeNull()
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
    await expect(
      client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' })
  })

  it('summarises when each of the household last saved, per app, and nobody else', async () => {
    let clock = new Date('2026-03-01T00:00:00Z')
    const client = new FakeFamilyClient({
      now: () => clock,
      parents: [
        { ...CREDENTIALS, id: 'parent-1' },
        { id: 'parent-2', name: 'Grace', email: 'grace@example.com', password: 'pw' },
      ],
    })
    await client.signIn({ email: 'grace@example.com', password: 'pw' })
    const grace = await client.addChild({ username: 'grace', displayName: 'Grace' })
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    const robin = await client.addChild({ username: 'robin', displayName: 'Robin' })

    const ada: FakeSessionInput = { sub: 'parent-1', role: 'parent', name: 'Ada' }
    const robinPlays: FakeSessionInput = {
      sub: robin.id,
      role: 'child',
      parentId: 'parent-1',
      name: 'Robin',
    }
    const gracesParent: FakeSessionInput = { sub: 'parent-2', role: 'parent', name: 'Grace' }
    const gracePlays: FakeSessionInput = {
      sub: grace.id,
      role: 'child',
      parentId: 'parent-2',
      name: 'Grace',
    }
    const saveAs = async (who: FakeSessionInput, appId: string, slotKey: string, iso: string) => {
      clock = new Date(iso)
      client.signInAs(who)
      await client.put({ appId, slotKey, blob: 'opaque' })
    }
    await saveAs(ada, 'boop', 'boop:save', '2026-03-01T00:00:00Z')
    await saveAs(robinPlays, 'silt', 'silt:scene:1', '2026-03-02T00:00:00Z')
    await saveAs(robinPlays, 'silt', 'silt:scene:2', '2026-03-05T00:00:00Z')
    await saveAs(robinPlays, 'boop', 'boop:save', '2026-03-03T00:00:00Z')
    await saveAs(gracesParent, 'boop', 'boop:save', '2026-03-04T00:00:00Z')
    await saveAs(gracePlays, 'boop', 'boop:save', '2026-03-04T00:00:00Z')

    await expect(client.saveSummary()).resolves.toEqual([
      { accountId: robin.id, appId: 'boop', updatedAt: Date.parse('2026-03-03T00:00:00Z') },
      { accountId: robin.id, appId: 'silt', updatedAt: Date.parse('2026-03-05T00:00:00Z') },
      { accountId: 'parent-1', appId: 'boop', updatedAt: Date.parse('2026-03-01T00:00:00Z') },
    ])
  })

  it('summarises nothing for a household with no saves', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    await expect(client.saveSummary()).resolves.toEqual([])
  })

  it('refuses the save summary to a family token alone', async () => {
    const client = withParent()
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ada' })
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })

    await expect(client.saveSummary()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('failWith reaches the identity half too', async () => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    client.failWith(new Error('the family service is unreachable'))
    await expect(client.listChildren()).rejects.toThrow('the family service is unreachable')
    await expect(client.me()).rejects.toThrow('the family service is unreachable')

    client.failWith(null)
    await expect(client.listChildren()).resolves.toEqual([])
  })
})

/**
 * The habit this package's README records: a fake that models only the happy
 * path and the typed refusals cannot see a validator, and four tickets running
 * it never did. These are the assertions that would have.
 */
describe('FakeFamilyClient runs the same validators the service runs', () => {
  const signedInParent = async (): Promise<FakeFamilyClient> => {
    const client = withParent()
    await client.signIn({ email: CREDENTIALS.email, password: CREDENTIALS.password })
    return client
  }

  it('refuses an over-long display name and username, as a 400 and not a crash', async () => {
    const client = await signedInParent()

    await expect(
      client.addChild({ username: 'robin', displayName: 'x'.repeat(33) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      client.addChild({ username: 'y'.repeat(33), displayName: 'Robin' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await client.listChildren()).toEqual([])
  })

  it('refuses a whitespace-only name, because the schema trims before it counts', async () => {
    const client = await signedInParent()
    await expect(client.addChild({ username: '   ', displayName: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  // The divergence that mattered: the real schema trims and the fake did not,
  // so the same input stored two different strings.
  it('stores the trimmed name, as Postgres would', async () => {
    const client = await signedInParent()
    const child = await client.addChild({ username: ' robin ', displayName: ' Robin ' })
    expect(child).toMatchObject({ username: 'robin', displayName: 'Robin' })
  })

  it('refuses a rename to an over-long name, and an id that is not a uuid', async () => {
    const client = await signedInParent()
    const child = await client.addChild({ username: 'robin', displayName: 'Robin' })

    await expect(
      client.renameChild({ id: child.id, displayName: 'x'.repeat(33) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      client.renameChild({ id: 'not-a-uuid', displayName: 'Bobbin' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect((await client.listChildren())[0]!.displayName).toBe('Robin')
  })

  it('refuses a new username that is over-long or blank, and stores it trimmed', async () => {
    const client = await signedInParent()
    const child = await client.addChild({ username: 'robin', displayName: 'Robin' })

    await expect(
      client.renameChild({ id: child.id, displayName: 'Robin', username: 'y'.repeat(33) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      client.renameChild({ id: child.id, displayName: 'Robin', username: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      client.renameChild({ id: child.id, displayName: 'Robin', username: ' bobbin ' }),
    ).resolves.toMatchObject({ username: 'bobbin' })
  })

  it('refuses to delete an id that is not a uuid', async () => {
    const client = await signedInParent()
    await expect(client.deleteChild({ id: 'not-a-uuid' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('refuses a slotKey past the contract bound', async () => {
    const client = signedIn()
    await expect(
      client.put({ appId: 'boop', slotKey: 'k'.repeat(129), blob: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('FakeFamilyClient enforces the save quotas (ADR 0079)', () => {
  it('refuses a blob over the slot cap, leaving the stored slot intact', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'keep me' })

    await expect(
      client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x'.repeat(MAX_SLOT_BYTES + 1) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('keep me')
  })

  // Summed across every appId, so one app cannot crowd out another.
  it('refuses a put that would take the account past its byte ceiling', async () => {
    const client = signedIn()
    const big = 'x'.repeat(MAX_SLOT_BYTES)
    for (let i = 0; i < MAX_ACCOUNT_BYTES / MAX_SLOT_BYTES; i++) {
      await client.put({ appId: 'boop', slotKey: `slot-${i}`, blob: big })
    }

    await expect(
      client.put({ appId: 'silt', slotKey: 'one-more', blob: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('caps rows as well as bytes, and still lets a full account rewrite what it holds', async () => {
    const client = signedIn()
    for (let i = 0; i < MAX_ACCOUNT_SLOTS; i++) {
      await client.put({ appId: 'boop', slotKey: `slot-${i}`, blob: '' })
    }

    await expect(
      client.put({ appId: 'boop', slotKey: 'one-more', blob: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      client.put({ appId: 'boop', slotKey: 'slot-0', blob: 'rewritten' }),
    ).resolves.toBeDefined()
  })
})
