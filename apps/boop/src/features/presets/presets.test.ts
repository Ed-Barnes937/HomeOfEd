import { describe, expect, it } from 'vitest'

import { MAX_BPM, MIN_BPM, STEPS_PER_PATTERN, type Kit } from '../../engine/sequencerEngine.ts'
import { PRESETS, presetPattern } from './presets.ts'

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

describe('starter-groove presets', () => {
  it('has the four fixed cards, in the design handoff\'s order', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(['blank', 'wonky', 'robot', 'stomp'])
    expect(PRESETS.map((preset) => preset.name)).toEqual([
      'Blank',
      'Wonky Walk',
      'Robot Hiccup',
      'Sunday Stomp',
    ])
  })

  it('materialises a full 6x16 pattern over the loaded kit\'s own instruments', () => {
    for (const preset of PRESETS) {
      const pattern = presetPattern(launchKit, preset)
      expect(pattern).toHaveLength(6)
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

  it('keeps every preset tempo inside the transport\'s bounds', () => {
    for (const preset of PRESETS) {
      expect(preset.tempo).toBeGreaterThanOrEqual(MIN_BPM)
      expect(preset.tempo).toBeLessThanOrEqual(MAX_BPM)
    }
  })

  it('blank is entirely empty, so it still means "clear the grid"', () => {
    const blank = PRESETS.find((preset) => preset.id === 'blank')
    expect(blank?.rows.every((row) => row.steps.every((on) => on === false))).toBe(true)
  })

  it('every non-blank preset has at least one active step, so it is audibly a groove', () => {
    for (const preset of PRESETS) {
      if (preset.id === 'blank') continue
      expect(preset.rows.some((row) => row.steps.some((on) => on))).toBe(true)
    }
  })

  it('at least one non-blank preset leaves a row empty for a kid to fill in', () => {
    const nonBlank = PRESETS.filter((preset) => preset.id !== 'blank')
    const hasEmptyRow = nonBlank.some((preset) => preset.rows.some((row) => row.steps.every((on) => !on)))
    expect(hasEmptyRow).toBe(true)
  })

  it('degrades a shorter kit to a shorter pattern rather than throwing', () => {
    const shortKit: Kit = { ...launchKit, instruments: launchKit.instruments.slice(0, 2) }
    const preset = PRESETS.find((p) => p.id === 'stomp')!
    const pattern = presetPattern(shortKit, preset)
    expect(pattern).toHaveLength(2)
    expect(pattern.map((row) => row.instrumentId)).toEqual(['kick', 'snare'])
  })
})
