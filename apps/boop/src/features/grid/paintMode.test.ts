import { describe, expect, it } from 'vitest'

import { decidePaintMode, paintModeToOn } from './paintMode.ts'

describe('decidePaintMode', () => {
  it('latches "add" when the pointer-down cell is off', () => {
    expect(decidePaintMode(false)).toBe('add')
  })

  it('latches "remove" when the pointer-down cell is on', () => {
    expect(decidePaintMode(true)).toBe('remove')
  })
})

describe('paintModeToOn', () => {
  it('"add" paints cells on', () => {
    expect(paintModeToOn('add')).toBe(true)
  })

  it('"remove" paints cells off', () => {
    expect(paintModeToOn('remove')).toBe(false)
  })
})
