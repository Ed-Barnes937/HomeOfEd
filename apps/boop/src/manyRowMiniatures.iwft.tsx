import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// The small-phone reference viewport: the one width that carries both
// miniatures at once — the loop map under the grid, and "My boops" thumbnails.
test.use({ viewport: { width: 390, height: 844 } })

/** The launch kit's whole roster, in manifest order — a clip's ceiling (ADR 0042). */
const ROSTER = [
  'kick',
  'snare',
  'hat',
  'tom',
  'marimba',
  'boop',
  'clap',
  'shaker',
  'cowbell',
  'woodblock',
  'triangle',
  'cymbal',
  'bass',
  'bell',
  'chime',
  'pluck',
  'boing',
  'pop',
  'zap',
  'drip',
]

const EMPTY = '0'.repeat(16)

/** A stored clip of the first `rowCount` roster rows, `painted` by instrument id. */
const clipOf = (rowCount: number, painted: Record<string, string>) => ({
  rows: ROSTER.slice(0, rowCount).map((instrumentId) => ({
    instrumentId,
    steps: painted[instrumentId] ?? EMPTY,
  })),
})

const boop = (name: string, rowCount: number, painted: Record<string, string>) => ({
  name,
  kitId: 'launch',
  tempo: 120,
  patterns: [clipOf(rowCount, painted)],
})

/**
 * One look at a clip that holds the whole roster, through the two places a
 * pattern is drawn in miniature: the loop map and `PatternThumbnail`. Both must
 * read the clip's real rows (ADR 0042) inside the footprint they had at six,
 * because the layouts around them — the reserved band under the grid, a "My
 * boops" row — cannot be allowed to move as a child adds sounds. The maths
 * itself is unit-tested (`thumbnailGeometry.test.ts`, `loopMap.test.ts`); this
 * is the look at it on a real page.
 */
test('a whole-roster clip draws every row in the miniatures, inside the six-row footprint', async ({
  mountApp,
  page,
}) => {
  // Seeded after the reload: the outgoing page flushes its pending autosave on
  // the way out, so seeding first would only be overwritten (grid.iwft).
  await page.reload()
  await page.evaluate(({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)), {
    key: SAVE_KEY,
    doc: {
      version: 1,
      // The working clip is the whole roster, with the *last* row the only one
      // carrying a note — nothing that reads only the launch six can pass.
      working: boop('', ROSTER.length, { drip: '0001000000000000' }),
      creations: [
        boop('Six rows', 6, { kick: '1000000000000000' }),
        boop('Twenty rows', ROSTER.length, { drip: '0001000000000000' }),
      ],
    },
  })

  const { root } = await mountApp()
  await root.verifyIsShown()

  // The loop map aggregates every row onto its 16 ticks, so the twentieth row's
  // note reaches it — and the band is still the handoff's 44px border box.
  await root.openClipEditor()
  await root.verifyLoopMapCoversWholeLoop()
  await root.verifyLoopTick(3, 'note')
  await root.verifyLoopTick(2, 'empty')
  await root.verifyLoopMapBandHeight(44)

  // Both thumbnails draw their own row count, in the same box, on rows of the
  // same height: twenty rows cost the list nothing.
  await root.closeClipEditor()
  await root.openPhoneMenu()
  await root.openBoopsFromPhoneMenu()
  await root.verifyBoopsPanelShown()
  const six = await root.readBoopThumbnail(0)
  const twenty = await root.readBoopThumbnail(1)

  expect(six.rows).toBe(6)
  expect(twenty.rows).toBe(ROSTER.length)
  expect(twenty.box).toBe(six.box)
  expect(twenty.row).toBe(six.row)

  // Twenty rows divide that box rather than spilling out of it, and every dot
  // is still at least a pixel of ink — blurred, but texture, not nothing.
  expect(twenty.ink).toBeLessThanOrEqual(twenty.box)
  expect(twenty.ink).toBeGreaterThan(twenty.box * 0.9)
  expect(twenty.shortestRow).toBeGreaterThanOrEqual(1)
})
