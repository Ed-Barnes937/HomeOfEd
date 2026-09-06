import { describe, expect, it } from 'vitest'

import { TINT_COUNT } from '../../persistence/saveFormat.ts'
import { CLIP_TINTS } from './clipTints.ts'

// The palette and the save format's `TINT_COUNT` are one decision in two files
// (ADR 0032, as amended by boop-clips tickets 04 and 05): a clip's stored
// `tint` is an index into this list, and `addClip` spreads clips over exactly
// `TINT_COUNT` of them. Nothing else notices a mismatch - `clipTint` falls
// back to the first colour - so a short list would quietly paint a tint the
// wrong colour, and a repeated entry would cost a child colours the tint
// cycle believes it has.
describe('CLIP_TINTS', () => {
  it('holds exactly one colour per tint the save format allows', () => {
    expect(CLIP_TINTS).toHaveLength(TINT_COUNT)
  })

  it('holds no colour twice, so the first ten clips wear ten colours', () => {
    expect(new Set(CLIP_TINTS).size).toBe(CLIP_TINTS.length)
  })
})
