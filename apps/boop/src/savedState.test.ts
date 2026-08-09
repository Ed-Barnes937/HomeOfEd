import { describe, expect, it } from 'vitest'

import {
  afterDelete,
  afterEdit,
  afterRename,
  afterSave,
  isUnsaved,
  savedStateLabel,
} from './savedState.ts'

const BOOP_2 = { index: 1, name: 'Boop 2', edited: false }

describe('savedStateLabel', () => {
  it('reads "Not saved yet" when no saved boop is loaded', () => {
    expect(savedStateLabel(null)).toBe('Not saved yet')
  })

  it('reads the loaded boop\'s name while it still matches what was saved', () => {
    expect(savedStateLabel({ index: 0, name: 'Boop 3', edited: false })).toBe('Boop 3')
  })

  it('marks a loaded boop that has diverged', () => {
    expect(savedStateLabel({ index: 0, name: 'Boop 3', edited: true })).toBe('Boop 3 • edited')
  })
})

describe('isUnsaved', () => {
  it('is true when nothing is loaded — there is no row in the list for this grid', () => {
    expect(isUnsaved(null)).toBe(true)
  })

  it('is true once the loaded boop has diverged', () => {
    expect(isUnsaved({ index: 1, name: 'Boop 2', edited: true })).toBe(true)
  })

  it('is false while the grid is the boop it was loaded from', () => {
    expect(isUnsaved(BOOP_2)).toBe(false)
  })
})

describe('afterEdit', () => {
  it('marks the loaded boop', () => {
    expect(afterEdit(BOOP_2)).toEqual({ ...BOOP_2, edited: true })
  })

  it('is idempotent, so painting a row does not churn the chrome', () => {
    const edited = { ...BOOP_2, edited: true }
    expect(afterEdit(edited)).toBe(edited)
  })

  it('has nothing to mark when no saved boop is loaded', () => {
    expect(afterEdit(null)).toBeNull()
  })
})

describe('afterSave', () => {
  it('adopts the new row, clean — saving is the moment "edited" clears', () => {
    expect(afterSave(2, 'Thunder')).toEqual({ index: 2, name: 'Thunder', edited: false })
  })
})

describe('afterRename', () => {
  it('renames the loaded boop without unloading it', () => {
    expect(afterRename(BOOP_2, 1, 'Thunder')).toEqual({ ...BOOP_2, name: 'Thunder' })
  })

  it('leaves the loaded boop alone when another row is renamed', () => {
    expect(afterRename(BOOP_2, 0, 'Thunder')).toBe(BOOP_2)
  })
})

describe('afterDelete', () => {
  it('ends the identity when the loaded row itself is thrown away', () => {
    expect(afterDelete(BOOP_2, 1)).toBeNull()
  })

  it('shifts the loaded row up when a row above it goes', () => {
    expect(afterDelete(BOOP_2, 0)).toEqual({ ...BOOP_2, index: 0 })
  })

  it('leaves the loaded row where it is when a row below it goes', () => {
    expect(afterDelete(BOOP_2, 2)).toBe(BOOP_2)
  })

  it('has nothing to move when no saved boop is loaded', () => {
    expect(afterDelete(null, 0)).toBeNull()
  })
})
