import type { ComponentPropsWithoutRef } from 'react'

export type CursorGlyphVariant = 'ring' | 'berry' | 'cat'

interface CursorGlyphProps extends ComponentPropsWithoutRef<'svg'> {
  variant: CursorGlyphVariant
}

/**
 * The little glyph that follows the pointer. `ring` is a neutral circle;
 * `berry` (attract) and `cat` (repel) are the sign-aware creatures — birds
 * swarm a berry, birds scatter from a cat. All draw in `currentColor` so the
 * overlay's CSS tints them per theme/sign. Extra `data-*`/props pass through to
 * the root `<svg>` (test hooks).
 */
export function CursorGlyph({ variant, ...rest }: CursorGlyphProps) {
  if (variant === 'berry') {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" {...rest}>
        <circle cx="13" cy="15.5" r="6.5" fill="currentColor" />
        <path
          d="M13 9V5.5M13 5.5c0-1.6 1.6-2.8 3.2-2.4C15.6 4.7 14.4 5.6 13 5.5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (variant === 'cat') {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" {...rest}>
        <path
          d="M6 6.5l3 4M20 6.5l-3 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="13" cy="14.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10.6" cy="13.5" r="1" fill="currentColor" />
        <circle cx="15.4" cy="13.5" r="1" fill="currentColor" />
        <path
          d="M11.4 16.4c.9.7 2.3.7 3.2 0M8 15l-2.4-.6M8 16.5l-2.4.5M18 15l2.4-.6M18 16.5l2.4.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" {...rest}>
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="13" cy="13" r="1.3" fill="currentColor" />
    </svg>
  )
}
