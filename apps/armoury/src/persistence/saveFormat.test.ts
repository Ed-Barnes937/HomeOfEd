import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { fakeSword } from '../items/testing/fakeItem.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import {
  decodeStored,
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
    expect(parseSaveDocument(wandSchema, serializeSaveDocument(doc))).toEqual(doc)
  })

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['not JSON', '{oops'],
    ['an array', '[]'],
    ['a future version', JSON.stringify({ version: 99, working: null, shelf: [] })],
    ['a shelf that is not a list', JSON.stringify({ version: 1, working: null, shelf: {} })],
  ])('reads %s as empty', (_, raw) => {
    expect(parseSaveDocument(wandSchema, raw)).toEqual(EMPTY_DOCUMENT)
  })

  it.each([
    ['null', 'null'],
    ['a number', '7'],
    ['a string', '"wand"'],
    ['no version', JSON.stringify({ working: null, shelf: [] })],
    ['a version in words', JSON.stringify({ version: '1', working: null, shelf: [] })],
    ['no shelf', JSON.stringify({ version: 1, working: { params } })],
  ])('reads %s as empty', (_, raw) => {
    expect(parseSaveDocument(wandSchema, raw)).toEqual(EMPTY_DOCUMENT)
  })

  it('drops a broken wand from the shelf but keeps the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      working: null,
      shelf: [{ params }, { params: 'nope' }, 42, { params, name: 7 }],
    })
    expect(parseSaveDocument(wandSchema, raw).shelf).toEqual([{ params }])
  })

  it('reads a working item that is not one as none, and keeps the shelf', () => {
    const raw = JSON.stringify({ version: 1, working: [params], shelf: [{ params }] })
    expect(parseSaveDocument(wandSchema, raw)).toEqual({
      version: 1,
      working: null,
      shelf: [{ params }],
    })
  })

  it('stays version 1, with nothing in it that names a kind', () => {
    expect(SAVE_FORMAT_VERSION).toBe(1)
    expect(serializeSaveDocument({ ...EMPTY_DOCUMENT, working: { params } })).toBe(
      `{"version":1,"working":{"params":${JSON.stringify(params)}},"shelf":[]}`,
    )
  })

  it('reads and rewrites a version 1 wand document byte for byte', () => {
    const written = JSON.stringify({
      version: 1,
      working: { params, name: 'Sparky' },
      shelf: [{ params: defaults(wandSchema) }, { params, name: 'Twiggy' }],
    })
    expect(serializeSaveDocument(parseSaveDocument(wandSchema, written))).toBe(written)
  })

  it('decodes each kind by its own schema', () => {
    const sword = { params: { ...fakeSword.firstVisit(), guard: 'ring' }, name: 'Needle' }
    const raw = serializeSaveDocument({ version: 1, working: sword, shelf: [sword] })
    expect(parseSaveDocument(fakeSword.schema, raw)).toEqual({
      version: 1,
      working: sword,
      shelf: [sword],
    })
    expect(parseSaveDocument(wandSchema, raw).working).toEqual({
      params: defaults(wandSchema),
      name: 'Needle',
    })
  })
})

describe('decodeStored', () => {
  it('normalises params, so a wand saved by an older or newer build still opens', () => {
    const decoded = decodeStored(wandSchema, {
      params: { lengthCm: 99, wood: 'oak', retired: 'x' },
    })
    expect(decoded?.params).toEqual(normalise(wandSchema, { lengthCm: 38, wood: 'oak' }))
  })

  it('keeps a name only when it is a non-blank string', () => {
    expect(decodeStored(wandSchema, { params, name: '  Sparky ' })?.name).toBe('Sparky')
    expect(decodeStored(wandSchema, { params, name: '   ' })).toEqual({ params })
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'wand'],
    ['a list', [{ params }]],
    ['no params', { name: 'Sparky' }],
    ['params that are a list', { params: [] }],
    ['a name that is not words', { params, name: 7 }],
  ])('reads %s as no item at all', (_, value) => {
    expect(decodeStored(wandSchema, value)).toBeNull()
  })
})
