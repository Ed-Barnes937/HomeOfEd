import { describe, expect, it } from 'vitest'

import {
  SMALLEST_THUMBNAIL_FOOTPRINT_PX,
  THUMBNAIL_BASELINE_ROWS,
  THUMBNAIL_DOT_SHARE,
  thumbnailRowGeometry,
} from './thumbnailGeometry.ts'

/** Every row count a clip can hold (ADR 0042: 1..the launch roster's 20). */
const ROW_COUNTS = Array.from({ length: 20 }, (_, index) => index + 1)

describe('thumbnailRowGeometry', () => {
  it('keeps the handoff pitch at and below six rows — those thumbnails are unchanged', () => {
    for (const rowCount of ROW_COUNTS.filter((n) => n <= THUMBNAIL_BASELINE_ROWS)) {
      expect(thumbnailRowGeometry(rowCount)).toBeNull()
    }
  })

  it('scales past six rows rather than growing the box', () => {
    for (const rowCount of ROW_COUNTS.filter((n) => n > THUMBNAIL_BASELINE_ROWS)) {
      expect(thumbnailRowGeometry(rowCount)).not.toBeNull()
    }
  })

  it('divides the fixed footprint between the rows, filling it without overflowing', () => {
    for (const rowCount of ROW_COUNTS.filter((n) => n > THUMBNAIL_BASELINE_ROWS)) {
      const geometry = thumbnailRowGeometry(rowCount)!
      const filled = rowCount * geometry.rowPitchPercent
      expect(filled).toBeLessThanOrEqual(100)
      // Within a rounding hair of the whole box: the rows *are* the footprint.
      expect(filled).toBeGreaterThan(99.9)
    }
  })

  it('holds the handoff dot-to-pitch share while the floor is slack', () => {
    // Up to 17 rows the handoff's own 0.55 already clears a pixel of ink.
    for (const rowCount of [7, 10, 15, 17]) {
      expect(thumbnailRowGeometry(rowCount)!.dotHeightPercent).toBe(55)
    }
  })

  it('starts spending the gap on the dot at eighteen rows — the phone box runs out first', () => {
    expect(thumbnailRowGeometry(17)!.dotHeightPercent).toBe(55)
    expect(thumbnailRowGeometry(18)!.dotHeightPercent).toBeGreaterThan(55)
  })

  it('floors the dot at a pixel on the shortest footprint, so many rows stay texture', () => {
    for (const rowCount of ROW_COUNTS.filter((n) => n > THUMBNAIL_BASELINE_ROWS)) {
      const geometry = thumbnailRowGeometry(rowCount)!
      const pitchPx = (SMALLEST_THUMBNAIL_FOOTPRINT_PX * geometry.rowPitchPercent) / 100
      const dotPx = (pitchPx * geometry.dotHeightPercent) / 100
      expect(dotPx).toBeGreaterThanOrEqual(1)
    }
  })

  it('spends the floor on the gap, never on the footprint', () => {
    // At the roster's 20 rows the floor is binding — the dots still fit inside
    // the box, they just leave less room between themselves.
    const geometry = thumbnailRowGeometry(20)!
    expect(geometry.dotHeightPercent).toBeGreaterThan(THUMBNAIL_DOT_SHARE * 100)
    expect(geometry.dotHeightPercent).toBeLessThanOrEqual(100)
    const inkPercent = 20 * geometry.rowPitchPercent * (geometry.dotHeightPercent / 100)
    expect(inkPercent).toBeLessThanOrEqual(100)
  })

  it('reads a nonsense row count as the baseline rather than dividing by nothing', () => {
    expect(thumbnailRowGeometry(0)).toBeNull()
    expect(thumbnailRowGeometry(-3)).toBeNull()
  })
})
