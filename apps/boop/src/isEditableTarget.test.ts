import { describe, expect, it } from 'vitest'

import { isEditableTarget } from './isEditableTarget.ts'

/** A plain object shaped like the DOM element `isEditableTarget` actually receives at runtime. */
function element(tagName: string, isContentEditable = false): EventTarget {
  return { tagName, isContentEditable } as unknown as EventTarget
}

describe('isEditableTarget', () => {
  it('is true for text inputs, so Space types a space rather than toggling play', () => {
    expect(isEditableTarget(element('INPUT'))).toBe(true)
  })

  it('is true for textareas', () => {
    expect(isEditableTarget(element('TEXTAREA'))).toBe(true)
  })

  it('is true for contenteditable elements', () => {
    expect(isEditableTarget(element('DIV', true))).toBe(true)
  })

  it('is false for a plain button, so Space still reaches the global play toggle', () => {
    expect(isEditableTarget(element('BUTTON'))).toBe(false)
  })

  it('is false for null (no focused element)', () => {
    expect(isEditableTarget(null)).toBe(false)
  })
})
