import { describe, expect, it } from 'vitest'

import { FAVOURITES_KEY, loadFavourites, toggleFavourite } from './favourites.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

describe('loadFavourites', () => {
  it('is empty when nothing has been stored', () => {
    expect(loadFavourites(new FakeStorage())).toEqual([])
  })

  it('reads back what was stored', () => {
    const storage = new FakeStorage()
    storage.setItem(FAVOURITES_KEY, JSON.stringify(['cowbell', 'zap']))

    expect(loadFavourites(storage)).toEqual(['cowbell', 'zap'])
  })

  it('is empty when the stored blob is corrupt', () => {
    const storage = new FakeStorage()
    storage.setItem(FAVOURITES_KEY, '{not json')

    expect(loadFavourites(storage)).toEqual([])
  })

  it('is empty when the stored blob is not an array of strings', () => {
    const storage = new FakeStorage()
    storage.setItem(FAVOURITES_KEY, JSON.stringify({ cowbell: true }))
    expect(loadFavourites(storage)).toEqual([])

    storage.setItem(FAVOURITES_KEY, JSON.stringify(['cowbell', 42]))
    expect(loadFavourites(storage)).toEqual([])
  })

  it('is empty when storage cannot be read at all', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(loadFavourites(storage)).toEqual([])
  })
})

describe('toggleFavourite', () => {
  it('adds a sound that is not yet a favourite', () => {
    const storage = new FakeStorage()

    toggleFavourite(storage, 'cowbell')

    expect(loadFavourites(storage)).toEqual(['cowbell'])
  })

  it('removes a sound that already is one', () => {
    const storage = new FakeStorage()
    toggleFavourite(storage, 'cowbell')
    toggleFavourite(storage, 'zap')

    toggleFavourite(storage, 'cowbell')

    expect(loadFavourites(storage)).toEqual(['zap'])
  })

  it('keeps ids the loaded kit no longer contains — forward-compat, like the save format', () => {
    // The store knows nothing about kits: an id from a bigger future kit must
    // survive a toggle made while a smaller kit is loaded.
    const storage = new FakeStorage()
    storage.setItem(FAVOURITES_KEY, JSON.stringify(['from-a-future-kit']))

    toggleFavourite(storage, 'cowbell')

    expect(loadFavourites(storage)).toEqual(['from-a-future-kit', 'cowbell'])
  })

  it('swallows a storage that refuses to write', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(() => toggleFavourite(storage, 'cowbell')).not.toThrow()
  })
})
