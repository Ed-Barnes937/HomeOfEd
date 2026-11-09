import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import {
  decodeStoredWand,
  EMPTY_DOCUMENT,
  parseSaveDocument,
  SAVE_FORMAT_VERSION,
  serializeSaveDocument,
  type SaveDocument,
} from './saveFormat.ts'

const params = normalise(wandSchema, { wood: 'maple', core: 'wildwood', lengthCm: 31 })

describe('the save document', () => {
  it('round-trips the working wand and the shelf', () => {
    const doc: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { params },
      shelf: [{ params, name: 'Twiggy' }, { params: defaults(wandSchema) }],
    }
    expect(parseSaveDocument(serializeSaveDocument(doc))).toEqual(doc)
  })

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['not JSON', '{oops'],
    ['an array', '[]'],
    ['a future version', JSON.stringify({ version: 99, working: null, shelf: [] })],
    ['a shelf that is not a list', JSON.stringify({ version: 1, working: null, shelf: {} })],
  ])('reads %s as empty', (_, raw) => {
    expect(parseSaveDocument(raw)).toEqual(EMPTY_DOCUMENT)
  })

  it('drops a broken wand from the shelf but keeps the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      working: null,
      shelf: [{ params }, { params: 'nope' }, 42, { params, name: 7 }],
    })
    expect(parseSaveDocument(raw).shelf).toEqual([{ params }])
  })
})

describe('decodeStoredWand', () => {
  it('normalises params, so a wand saved by an older or newer build still opens', () => {
    const decoded = decodeStoredWand({ params: { lengthCm: 99, wood: 'oak', retired: 'x' } })
    expect(decoded?.params).toEqual(normalise(wandSchema, { lengthCm: 38, wood: 'oak' }))
  })

  it('keeps a name only when it is a non-blank string', () => {
    expect(decodeStoredWand({ params, name: '  Sparky ' })?.name).toBe('Sparky')
    expect(decodeStoredWand({ params, name: '   ' })).toEqual({ params })
  })
})
