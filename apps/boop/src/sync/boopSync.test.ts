import { FamilyClientError, type FamilySaveContract, type SavePutInput } from '@hoe/accounts'
import { FakeFamilyClient } from '@hoe/accounts/testing/fake'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SAVE_FORMAT_VERSION,
  serializeSaveDocument,
  type SaveDocument,
  type StoredBoop,
} from '../persistence/saveFormat.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { FakeStorage } from '../persistence/testing/fakeStorage.ts'
import { BOOP_APP_ID, createBoopSync } from './boopSync.ts'

function boop(name: string): StoredBoop {
  return {
    name,
    kitId: 'launch',
    tempo: 100,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  }
}

function document_(working: StoredBoop | null, creations: readonly StoredBoop[]): string {
  const doc: SaveDocument = { version: SAVE_FORMAT_VERSION, working, creations }
  return serializeSaveDocument(doc)
}

const slot = { appId: BOOP_APP_ID, slotKey: SAVE_KEY }

let client: FakeFamilyClient
let storage: FakeStorage

beforeEach(() => {
  client = new FakeFamilyClient()
  client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Ada' })
  storage = new FakeStorage()
})

async function remoteBlob(): Promise<string | null> {
  return (await client.get(slot))?.blob ?? null
}

describe('reconcile', () => {
  it('brings the account’s boops down into localStorage', async () => {
    await client.put({ ...slot, blob: document_(null, [boop('theirs')]) })
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))

    await createBoopSync({ client, storage }).reconcile()

    expect(storage.store.get(SAVE_KEY)).toBe(document_(null, [boop('theirs'), boop('mine')]))
  })

  it('pushes the union back when the merge gave the account something new', async () => {
    await client.put({ ...slot, blob: document_(null, [boop('theirs')]) })
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))

    await createBoopSync({ client, storage }).reconcile()

    expect(await remoteBlob()).toBe(document_(null, [boop('theirs'), boop('mine')]))
  })

  it('leaves the account alone when the merge changed nothing there', async () => {
    const same = document_(null, [boop('shared')])
    await client.put({ ...slot, blob: same })
    storage.setItem(SAVE_KEY, same)

    await createBoopSync({ client, storage }).reconcile()

    expect((await client.get(slot))?.version).toBe(1)
  })

  it('copies a first device’s boops up when the account holds no slot yet', async () => {
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))

    await createBoopSync({ client, storage }).reconcile()

    expect(await remoteBlob()).toBe(document_(null, [boop('mine')]))
  })

  it('writes nothing locally when neither side holds anything', async () => {
    await createBoopSync({ client, storage }).reconcile()

    expect(storage.store.has(SAVE_KEY)).toBe(false)
  })

  it('keeps the local working grid and takes the account’s only when there is none', async () => {
    await client.put({ ...slot, blob: document_(boop('theirs'), []) })
    storage.setItem(SAVE_KEY, document_(boop('mine'), []))

    await createBoopSync({ client, storage }).reconcile()

    expect(storage.store.get(SAVE_KEY)).toBe(document_(boop('mine'), []))
  })

  it('degrades a nonsense remote blob to empty instead of erroring at a child', async () => {
    await client.put({ ...slot, blob: '{"version":99,"not":"boop’s"}' })
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))

    await expect(createBoopSync({ client, storage }).reconcile()).resolves.toBeUndefined()

    expect(storage.store.get(SAVE_KEY)).toBe(document_(null, [boop('mine')]))
  })

  it('never rejects when every call to the service throws', async () => {
    client.failWith(new Error('the family service is down'))
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))

    await expect(createBoopSync({ client, storage }).reconcile()).resolves.toBeUndefined()

    expect(storage.store.get(SAVE_KEY)).toBe(document_(null, [boop('mine')]))
  })

  it('keeps an autosave that landed while the pull was in flight', async () => {
    await client.put({ ...slot, blob: document_(null, [boop('theirs')]) })
    storage.setItem(SAVE_KEY, document_(boop('before'), []))
    // The child kept playing: the autosave writes while `get` is still out.
    const slow = delayGet(client, () => {
      storage.setItem(SAVE_KEY, document_(boop('after'), []))
    })

    await createBoopSync({ client: slow, storage }).reconcile()

    expect(storage.store.get(SAVE_KEY)).toBe(document_(boop('after'), [boop('theirs')]))
  })
})

describe('pushIfChanged', () => {
  it('does nothing until a pull has succeeded, so a device cannot overwrite what it never saw', async () => {
    await client.put({ ...slot, blob: document_(null, [boop('theirs')]) })
    client.failWith(new Error('offline at startup'))
    const sync = createBoopSync({ client, storage })
    await sync.reconcile()

    client.failWith(null)
    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))
    await sync.pushIfChanged()

    expect(await remoteBlob()).toBe(document_(null, [boop('theirs')]))
  })

  it('copies the save document up once the bytes change, and not again', async () => {
    const sync = createBoopSync({ client, storage })
    await sync.reconcile()

    storage.setItem(SAVE_KEY, document_(null, [boop('mine')]))
    await sync.pushIfChanged()
    await sync.pushIfChanged()
    await sync.pushIfChanged()

    expect(await remoteBlob()).toBe(document_(null, [boop('mine')]))
    expect((await client.get(slot))?.version).toBe(1)
  })

  it('takes a quota rejection as a normal outcome and does not retry the same bytes', async () => {
    const puts: SavePutInput[] = []
    const capped: FamilySaveContract = {
      get: (input) => client.get(input),
      list: (input) => client.list(input),
      delete: (input) => client.delete(input),
      put: (input) => {
        puts.push(input)
        return Promise.reject(new FamilyClientError('slot is too big', 'BAD_REQUEST'))
      },
    }
    const sync = createBoopSync({ client: capped, storage })
    await sync.reconcile()

    storage.setItem(SAVE_KEY, document_(null, [boop('enormous')]))
    await sync.pushIfChanged()
    await sync.pushIfChanged()
    await sync.pushIfChanged()

    expect(puts).toHaveLength(1)
  })

  it('tries again once the child changes something else', async () => {
    const sync = createBoopSync({ client, storage })
    await sync.reconcile()
    client.failWith(new Error('a blip'))

    storage.setItem(SAVE_KEY, document_(null, [boop('one')]))
    await sync.pushIfChanged()

    client.failWith(null)
    storage.setItem(SAVE_KEY, document_(null, [boop('one'), boop('two')]))
    await sync.pushIfChanged()

    expect(await remoteBlob()).toBe(document_(null, [boop('one'), boop('two')]))
  })

  it('never rejects when storage itself is unavailable', async () => {
    const sync = createBoopSync({ client, storage })
    await sync.reconcile()
    storage.unavailable = true

    await expect(sync.pushIfChanged()).resolves.toBeUndefined()
  })
})

/** The same fake, with a hook that runs while `get` is still in flight. */
function delayGet(inner: FamilySaveContract, duringFlight: () => void): FamilySaveContract {
  return {
    get: async (input) => {
      const result = await inner.get(input)
      duringFlight()
      return result
    },
    put: (input) => inner.put(input),
    list: (input) => inner.list(input),
    delete: (input) => inner.delete(input),
  }
}
