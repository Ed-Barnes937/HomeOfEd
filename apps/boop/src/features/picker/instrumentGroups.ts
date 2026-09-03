import {
  INSTRUMENT_GROUPS,
  type InstrumentGroup,
  type Kit,
  type KitInstrument,
} from '../../engine/sequencerEngine.ts'

/** The child-facing heading for each group (spec §2). */
const GROUP_LABELS: Record<InstrumentGroup, string> = {
  drums: 'Drums',
  notes: 'Notes',
  silly: 'Silly',
}

/**
 * Heading for instruments the manifest gives no `group`. Never seen on the
 * launch kit — every one of its 20 carries a group — but a kit written before
 * the field existed must still offer all of its sounds, so they get a section
 * of their own rather than falling out of the picker.
 */
export const UNGROUPED_SECTION_LABEL = 'Sounds'

/** One labelled block of the instrument picker. */
export interface InstrumentSection {
  /** The group, or `other` for the ungrouped tail. */
  id: string
  label: string
  instruments: readonly KitInstrument[]
}

/**
 * The roster as the picker's sections: Drums, then Notes, then Silly (spec §2),
 * each holding its instruments **in manifest order** — so the manifest is still
 * the only thing that decides which sounds exist and in what order they read.
 * An empty group is dropped; ungrouped instruments follow in one last section.
 */
export function instrumentSections(kit: Kit): InstrumentSection[] {
  const sections: InstrumentSection[] = []
  for (const group of INSTRUMENT_GROUPS) {
    const instruments = kit.instruments.filter((instrument) => instrument.group === group)
    if (instruments.length > 0) {
      sections.push({ id: group, label: GROUP_LABELS[group], instruments })
    }
  }
  const ungrouped = kit.instruments.filter((instrument) => instrument.group === undefined)
  if (ungrouped.length > 0) {
    sections.push({ id: 'other', label: UNGROUPED_SECTION_LABEL, instruments: ungrouped })
  }
  return sections
}
