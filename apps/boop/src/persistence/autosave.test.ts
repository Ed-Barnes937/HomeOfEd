import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTOSAVE_LULL_MS, AUTOSAVE_MAX_WAIT_MS, createAutosave } from './autosave.ts'
import type { StoredBoop } from './saveFormat.ts'
import { loadSaveDocument } from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const base: StoredBoop = {
  name: '',
  kitId: 'launch',
  tempo: 100,
  patterns: [{ rows: [{ instrumentId: 'kick', steps: '0'.repeat(16) }] }],
}

const at = (tempo: number): StoredBoop => ({ ...base, tempo })

describe('createAutosave', () => {
  let storage: FakeStorage

  beforeEach(() => {
    vi.useFakeTimers()
    storage = new FakeStorage()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not write until the edits stop', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(100))
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS - 1)

    expect(loadSaveDocument(storage).working).toBeNull()
  })

  it('writes once the lull has passed', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(120))
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS)

    expect(loadSaveDocument(storage).working).toEqual(at(120))
  })

  it('coalesces a burst of edits into one write of the latest state', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(100))
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS - 100)
    autosave.schedule(at(110))
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS - 100)
    autosave.schedule(at(120))

    expect(loadSaveDocument(storage).working).toBeNull()

    vi.advanceTimersByTime(AUTOSAVE_LULL_MS)

    expect(loadSaveDocument(storage).working).toEqual(at(120))
  })

  it('writes at the max wait even when the edits never lull', () => {
    const autosave = createAutosave(storage)
    let tempo = 100

    // Edits closer together than the lull, for longer than the max wait.
    for (let elapsed = 0; elapsed < AUTOSAVE_MAX_WAIT_MS; elapsed += AUTOSAVE_LULL_MS - 100) {
      tempo += 1
      autosave.schedule(at(tempo))
      vi.advanceTimersByTime(AUTOSAVE_LULL_MS - 100)
    }

    expect(loadSaveDocument(storage).working).toEqual(at(tempo))
  })

  it('starts a fresh max wait for the next burst', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(100))
    vi.advanceTimersByTime(AUTOSAVE_MAX_WAIT_MS * 2)
    autosave.schedule(at(120))

    expect(loadSaveDocument(storage).working).toEqual(at(100))

    vi.advanceTimersByTime(AUTOSAVE_LULL_MS)

    expect(loadSaveDocument(storage).working).toEqual(at(120))
  })

  it('flushes pending work immediately — the tab is closing', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(140))
    autosave.flush()

    expect(loadSaveDocument(storage).working).toEqual(at(140))
  })

  it('does not write again after a flush leaves nothing pending', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(140))
    autosave.flush()
    storage.store.clear()
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS * 2)

    expect(loadSaveDocument(storage).working).toBeNull()
  })

  it('drops pending work on dispose — the engine it described is gone', () => {
    const autosave = createAutosave(storage)

    autosave.schedule(at(160))
    autosave.dispose()
    vi.advanceTimersByTime(AUTOSAVE_LULL_MS * 2)

    expect(loadSaveDocument(storage).working).toBeNull()
  })
})
