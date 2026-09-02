import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseKitManifest } from '../../engine/kitManifest.ts'
import { DEFAULT_BPM, STEPS_PER_PATTERN, type Kit } from '../../engine/sequencerEngine.ts'
import { SONG_POSITIONS } from '../../persistence/saveFormat.ts'
import { firstVisitSong, SAMPLE_CLIPS, samplePattern } from './sampleClips.ts'

const launchKit: Kit = {
  kitId: 'launch',
  name: 'Launch kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'kick.svg', sound: 'kick.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: 'snare.svg', sound: 'snare.wav' },
    { instrumentId: 'hat', name: 'Hi-hat', artwork: 'hat.svg', sound: 'hat.wav' },
    { instrumentId: 'tom', name: 'Tom', artwork: 'tom.svg', sound: 'tom.wav' },
    { instrumentId: 'marimba', name: 'Marimba', artwork: 'marimba.svg', sound: 'marimba.wav' },
    { instrumentId: 'boop', name: 'Boop', artwork: 'boop.svg', sound: 'boop.wav' },
  ],
}

/** The on-steps of one materialised row, 0-based. */
function onSteps(kit: Kit, sampleId: string, instrumentId: string): number[] {
  const sample = SAMPLE_CLIPS.find((s) => s.id === sampleId)!
  const row = samplePattern(kit, sample.rows).find((r) => r.instrumentId === instrumentId)!
  return row.steps.flatMap((on, step) => (on ? [step] : []))
}

describe('the sample-clip roster', () => {
  it('ships all eight, in the picker\'s fixed order, with their plain labels', () => {
    expect(SAMPLE_CLIPS.map((sample) => [sample.id, sample.label])).toEqual([
      ['slow-bass', 'Slow bass'],
      ['bouncy-bass', 'Bouncy bass'],
      ['tap-tap-hat', 'Tap tap hat'],
      ['sneaky-hat', 'Sneaky hat'],
      ['boom-clap', 'Boom clap'],
      ['tumble-toms', 'Tumble toms'],
      ['twinkle-tune', 'Twinkle tune'],
      ['boop-boop', 'Boop boop'],
    ])
  })

  // The patterns are the prototype's, lifted verbatim (spec §6; the ticket's
  // steps are 1-based, these are the same steps 0-based).
  it('matches the prototype patterns, step for step', () => {
    expect(onSteps(launchKit, 'slow-bass', 'kick')).toEqual([0, 8])
    expect(onSteps(launchKit, 'bouncy-bass', 'kick')).toEqual([0, 3, 8, 11])
    expect(onSteps(launchKit, 'tap-tap-hat', 'hat')).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(onSteps(launchKit, 'sneaky-hat', 'hat')).toEqual([2, 6, 10, 14])
    expect(onSteps(launchKit, 'boom-clap', 'kick')).toEqual([0, 8])
    expect(onSteps(launchKit, 'boom-clap', 'snare')).toEqual([4, 12])
    expect(onSteps(launchKit, 'tumble-toms', 'tom')).toEqual([6, 7, 14, 15])
    expect(onSteps(launchKit, 'twinkle-tune', 'marimba')).toEqual([0, 3, 6, 10, 12])
    expect(onSteps(launchKit, 'twinkle-tune', 'boop')).toEqual([14])
    expect(onSteps(launchKit, 'boop-boop', 'boop')).toEqual([4, 5, 12, 13])
  })

  it('keeps every other row of every sample silent — each is one layer', () => {
    const expectedOnRows: Record<string, string[]> = {
      'slow-bass': ['kick'],
      'bouncy-bass': ['kick'],
      'tap-tap-hat': ['hat'],
      'sneaky-hat': ['hat'],
      'boom-clap': ['kick', 'snare'],
      'tumble-toms': ['tom'],
      'twinkle-tune': ['marimba', 'boop'],
      'boop-boop': ['boop'],
    }
    for (const sample of SAMPLE_CLIPS) {
      const soundingRows = samplePattern(launchKit, sample.rows)
        .filter((row) => row.steps.some((on) => on))
        .map((row) => row.instrumentId)
      expect(soundingRows).toEqual(expectedOnRows[sample.id])
    }
  })

  it('materialises a full 6x16 pattern over the loaded kit\'s own instruments', () => {
    for (const sample of SAMPLE_CLIPS) {
      const pattern = samplePattern(launchKit, sample.rows)
      expect(pattern.map((row) => row.instrumentId)).toEqual([
        'kick',
        'snare',
        'hat',
        'tom',
        'marimba',
        'boop',
      ])
      for (const row of pattern) {
        expect(row.steps).toHaveLength(STEPS_PER_PATTERN)
      }
    }
  })

  it('degrades a shorter kit to a shorter pattern rather than throwing', () => {
    const shortKit: Kit = { ...launchKit, instruments: launchKit.instruments.slice(0, 2) }
    const sample = SAMPLE_CLIPS.find((s) => s.id === 'boom-clap')!
    const pattern = samplePattern(shortKit, sample.rows)
    expect(pattern).toHaveLength(2)
    expect(pattern.map((row) => row.instrumentId)).toEqual(['kick', 'snare'])
  })
})

// Ticket 03 / spec §5: the authored clips are position-keyed over the roster's
// first six, so growing the manifest to twenty must not move them. This reads
// the real `kit.json` because the manifest is the only enumeration of
// instrument ids (apps/boop/CLAUDE.md).
describe('against the real launch roster', () => {
  const publicDir = fileURLToPath(new URL('../../../public/', import.meta.url))

  it('resolves every authored position to the classic six it was written for', async () => {
    const roster = parseKitManifest(
      JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8')),
    )

    expect(roster.instruments.slice(0, 6).map((i) => i.instrumentId)).toEqual([
      'kick',
      'snare',
      'hat',
      'tom',
      'marimba',
      'boop',
    ])
    // Same sounding rows on the twenty-instrument roster as on the six.
    for (const sample of SAMPLE_CLIPS) {
      const sounding = (kit: Kit) =>
        samplePattern(kit, sample.rows)
          .filter((row) => row.steps.some((on) => on))
          .map((row) => `${row.instrumentId}:${row.steps.map((on) => (on ? 1 : 0)).join('')}`)

      expect(sounding(roster)).toEqual(sounding(launchKit))
    }
  })
})

describe('the first-visit seed', () => {
  it('is a one-clip song built from a sample clip, named after it, at the default tempo', () => {
    const song = firstVisitSong(launchKit)
    expect(song.clips).toHaveLength(1)
    expect(song.clips[0]!.name).toBe('Boom clap')
    expect(song.clips[0]!.tint).toBe(0)
    expect(song.bpm).toBe(DEFAULT_BPM)
    expect(song.activeClipIndex).toBe(0)
    // A one-clip song with an empty song bar — placing it is the child's move.
    expect(song.placements).toEqual(Array.from({ length: SONG_POSITIONS }, () => []))
    // It still sounds like something: the sample's kick and snare are on.
    const kick = song.clips[0]!.pattern.find((row) => row.instrumentId === 'kick')!
    expect(kick.steps[0]).toBe(true)
  })
})
