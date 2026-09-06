import { describe, expect, it } from 'vitest'

import { TINT_COUNT } from '../../persistence/saveFormat.ts'
import { CLIP_TINTS } from './clipTints.ts'

// The palette and the save format's `TINT_COUNT` are one decision in two files
// (ADR 0032, as amended by boop-clips ticket 04): the cap is the palette's
// length, and a clip's stored `tint` is an index into it. Nothing else notices
// a mismatch - `clipTint` falls back to the first colour - so a missing or
// repeated entry would quietly give two clips the same colour.
describe('CLIP_TINTS', () => {
  it('holds exactly one colour per tint the save format allows', () => {
    expect(CLIP_TINTS).toHaveLength(TINT_COUNT)
  })

  it('holds no colour twice, so one tint per clip means one colour per clip', () => {
    expect(new Set(CLIP_TINTS).size).toBe(CLIP_TINTS.length)
  })
})
