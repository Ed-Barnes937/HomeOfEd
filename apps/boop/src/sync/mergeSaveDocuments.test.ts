import { describe, expect, it } from 'vitest'

import {
  SAVE_FORMAT_VERSION,
  type SaveDocument,
  type StoredBoop,
} from '../persistence/saveFormat.ts'
import { mergeSaveDocuments } from './mergeSaveDocuments.ts'

function boop(name: string, steps = '1000000000000000'): StoredBoop {
  return {
    name,
    kitId: 'launch',
    tempo: 100,
    patterns: [{ rows: [{ instrumentId: 'kick', steps }] }],
  }
}

function doc(working: StoredBoop | null, creations: readonly StoredBoop[]): SaveDocument {
  return { version: SAVE_FORMAT_VERSION, working, creations }
}

describe('mergeSaveDocuments', () => {
  it('takes the remote list first, then the local creations it does not hold', () => {
    const merged = mergeSaveDocuments(
      doc(null, [boop('mine'), boop('shared')]),
      doc(null, [boop('shared'), boop('theirs')]),
    )

    expect(merged.creations.map((c) => c.name)).toEqual(['shared', 'theirs', 'mine'])
  })

  it('dedupes by deep equality, not by name', () => {
    const merged = mergeSaveDocuments(
      doc(null, [boop('same', '1111000000000000')]),
      doc(null, [boop('same', '0000000000000001')]),
    )

    expect(merged.creations).toHaveLength(2)
  })

  it('keeps a boop a child saved twice locally - two rows on disk is two rows', () => {
    const merged = mergeSaveDocuments(doc(null, [boop('twice'), boop('twice')]), doc(null, []))

    expect(merged.creations.map((c) => c.name)).toEqual(['twice', 'twice'])
  })

  it('keeps the local working grid when there is one', () => {
    const merged = mergeSaveDocuments(doc(boop('here'), []), doc(boop('elsewhere'), []))

    expect(merged.working?.name).toBe('here')
  })

  it('falls back to the remote working grid only when there is no local one', () => {
    const merged = mergeSaveDocuments(doc(null, []), doc(boop('elsewhere'), []))

    expect(merged.working?.name).toBe('elsewhere')
  })

  it('is idempotent: merging the result against the same remote changes nothing', () => {
    const local = doc(boop('working'), [boop('mine')])
    const remote = doc(boop('theirs-working'), [boop('theirs')])

    const once = mergeSaveDocuments(local, remote)
    const twice = mergeSaveDocuments(once, remote)

    expect(twice).toEqual(once)
  })

  it('is idempotent against itself - the union of a document with itself is the document', () => {
    const document_ = doc(boop('working'), [boop('a'), boop('b')])

    expect(mergeSaveDocuments(document_, document_)).toEqual(document_)
  })

  it('merges two empty documents into an empty one', () => {
    const merged = mergeSaveDocuments(doc(null, []), doc(null, []))

    expect(merged).toEqual(doc(null, []))
  })

  it('carries the optional song fields through untouched', () => {
    const arranged: StoredBoop = { ...boop('arranged'), placements: '1,,,,,,,,,,,,,,,', gridClip: 0 }

    const merged = mergeSaveDocuments(doc(null, []), doc(null, [arranged]))

    expect(merged.creations[0]).toEqual(arranged)
  })
})
