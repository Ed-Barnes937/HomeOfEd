import { test } from './testing/iwftTest.tsx'

// Favourite sounds (boop-favourites ticket 01): a star on each picker entry
// marks a sound as a favourite, and a Favourites section leads the picker while
// at least one exists. Copy, not move — the sound stays in its home group too.
// The store and the group derivation are unit-tested (favourites.test.ts,
// instrumentGroups.test.ts); this is the one whole-frontend pass the ticket
// asks for: star, reload, see the section.

const DEFAULT_ROWS = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']

test('starring shows the Favourites section, it survives a reload, unstarring the last removes it', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openRowInstrumentPicker('kick')
  await root.verifyInstrumentSections(['Drums', 'Notes', 'Silly'])

  // Star Cowbell from its home group. The star is its own hit target: the row
  // does not swap, the picker stays open, and Cowbell is still under Drums.
  await root.verifyFavouriteStar('drums', 'cowbell', 'Cowbell', false)
  await root.toggleFavourite('drums', 'cowbell')
  await root.verifyInstrumentSections(['Favourites', 'Drums', 'Notes', 'Silly'])
  await root.verifyInstrumentSectionEntries('favourites', ['Cowbell'])
  await root.verifyGridRows(DEFAULT_ROWS)
  await root.verifyInstrumentPickerShown()
  await root.verifyInstrumentSectionEntries('drums', [
    'Kick',
    'Snare',
    'Hi-hat',
    'Tom',
    'Clap',
    'Shaker',
    'Cowbell',
    'Woodblock',
    'Triangle',
    'Cymbal',
  ])
  // Both copies of the star read as on.
  await root.verifyFavouriteStar('drums', 'cowbell', 'Cowbell', true)
  await root.verifyFavouriteStar('favourites', 'cowbell', 'Cowbell', true)

  // Star Zap too: Favourites reads in manifest order (Cowbell is a drum, Zap
  // is silly), not the order they were starred in.
  await root.toggleFavourite('silly', 'zap')
  await root.verifyInstrumentSectionEntries('favourites', ['Cowbell', 'Zap'])

  // The favourites survive a reload, out of their own localStorage key.
  await page.reload()
  const { root: reloaded } = await mountApp()
  await reloaded.verifyIsShown()
  await reloaded.openClipEditor()
  await reloaded.openRowInstrumentPicker('kick')
  await reloaded.verifyInstrumentSections(['Favourites', 'Drums', 'Notes', 'Silly'])
  await reloaded.verifyInstrumentSectionEntries('favourites', ['Cowbell', 'Zap'])

  // Unstarring — from the Favourites section itself — removes each, and the
  // last one takes the section with it.
  await reloaded.toggleFavourite('favourites', 'zap')
  await reloaded.verifyInstrumentSectionEntries('favourites', ['Cowbell'])
  await reloaded.toggleFavourite('favourites', 'cowbell')
  await reloaded.verifyNoFavouritesSection()
  await reloaded.verifyInstrumentSections(['Drums', 'Notes', 'Silly'])
})

test('the star works by keyboard, and does not select the sound', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openRowInstrumentPicker('kick')

  // A keyboard user reaches the star as a button and toggles it with Enter.
  await root.favouriteStar('drums', 'cowbell').focus()
  await root.favouriteStar('drums', 'cowbell').press('Enter')
  await root.verifyFavouriteStar('drums', 'cowbell', 'Cowbell', true)
  await root.verifyInstrumentSections(['Favourites', 'Drums', 'Notes', 'Silly'])

  // Toggling never selected: the row still has its own sound.
  await root.verifyGridRows(DEFAULT_ROWS)

  await root.favouriteStar('drums', 'cowbell').press('Enter')
  await root.verifyNoFavouritesSection()
  await root.verifyGridRows(DEFAULT_ROWS)
})
