import { describe, expect, it } from 'vitest'

import { ROW_COLOR_VARS, rowColorVar } from './instrumentColors.ts'

/** The hues a clip of these rows wears, top to bottom - position is all that decides. */
const huesOf = (rows: readonly string[]) => rows.map((_, rowIndex) => rowColorVar(rowIndex))

describe('rowColorVar', () => {
  it('gives the six handoff hues to the first six rows, top to bottom', () => {
    expect(huesOf(['kick', 'snare', 'hat', 'tom', 'marimba', 'boop'])).toEqual([...ROW_COLOR_VARS])
  })

  it('cycles the six from the seventh row on (spec §10.2)', () => {
    expect(rowColorVar(6)).toBe(rowColorVar(0))
    expect(rowColorVar(7)).toBe(rowColorVar(1))
    // The roster's ceiling is twenty rows, so the cycle has to hold that far.
    expect(rowColorVar(19)).toBe(rowColorVar(1))
    expect(new Set(Array.from({ length: 20 }, (_, i) => rowColorVar(i))).size).toBe(
      ROW_COLOR_VARS.length,
    )
  })

  it('is positional, so deleting a row recolours the rows below it (spec §10.2, accepted)', () => {
    const before = huesOf(['kick', 'snare', 'hat', 'tom'])
    const after = huesOf(['kick', 'hat', 'tom'])

    // Every surviving row wears the hue of the position it *now* holds.
    expect(after).toEqual([before[0], before[1], before[2]])
    // Which is the accepted cost: the hi-hat row kept its steps and lost its
    // colour, because the colour was never the instrument's.
    expect(after[1]).not.toBe(before[2])
  })
})
