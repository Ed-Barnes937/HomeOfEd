import { describe, expect, it } from 'vitest'

import type { Kit, KitInstrument, InstrumentGroup } from '../../engine/sequencerEngine.ts'
import { instrumentSections, UNGROUPED_SECTION_LABEL } from './instrumentGroups.ts'

function instrument(instrumentId: string, group?: InstrumentGroup): KitInstrument {
  const entry: KitInstrument = {
    instrumentId,
    name: instrumentId,
    artwork: `${instrumentId}.svg`,
    sound: `${instrumentId}.wav`,
  }
  if (group) entry.group = group
  return entry
}

function kit(instruments: readonly KitInstrument[]): Kit {
  return { kitId: 'test', name: 'Test kit', instruments }
}

describe('instrumentSections', () => {
  it('sections the roster Drums / Notes / Silly, each in manifest order', () => {
    const sections = instrumentSections(
      kit([
        instrument('kick', 'drums'),
        instrument('marimba', 'notes'),
        instrument('boop', 'notes'),
        instrument('clap', 'drums'),
        instrument('boing', 'silly'),
        instrument('pop', 'silly'),
      ]),
    )

    expect(sections.map((section) => section.label)).toEqual(['Drums', 'Notes', 'Silly'])
    expect(sections.map((section) => section.instruments.map((i) => i.instrumentId))).toEqual([
      ['kick', 'clap'],
      ['marimba', 'boop'],
      ['boing', 'pop'],
    ])
  })

  it('drops a group no instrument belongs to', () => {
    const sections = instrumentSections(kit([instrument('kick', 'drums')]))

    expect(sections.map((section) => section.id)).toEqual(['drums'])
  })

  it('keeps ungrouped instruments pickable, in one section after the named ones', () => {
    // A kit that predates the manifest's `group` field must still offer every
    // instrument it has — the picker is the only way to reach one.
    const sections = instrumentSections(
      kit([instrument('kick', 'drums'), instrument('mystery'), instrument('other')]),
    )

    expect(sections.map((section) => section.label)).toEqual(['Drums', UNGROUPED_SECTION_LABEL])
    expect(sections[1]?.instruments.map((i) => i.instrumentId)).toEqual(['mystery', 'other'])
  })

  it('lists every instrument of the roster exactly once', () => {
    const roster = kit([
      instrument('kick', 'drums'),
      instrument('bass', 'notes'),
      instrument('zap', 'silly'),
      instrument('mystery'),
    ])

    const listed = instrumentSections(roster).flatMap((section) =>
      section.instruments.map((i) => i.instrumentId),
    )

    expect([...listed].sort()).toEqual(roster.instruments.map((i) => i.instrumentId).sort())
  })
})
