import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createSequencerEngine } from './engine/createSequencerEngine.ts'
import { parseKitManifest } from './engine/kitManifest.ts'
import { ANCHOR_PITCH_MASK, rowPitchMasks } from './engine/pitch.ts'
import { FakeAudioDriver } from './engine/testing/fakeAudioDriver.ts'
import { STEPS_PER_PATTERN, type Kit } from './engine/sequencerEngine.ts'
import { renderSequenceSamples } from './export/renderSequence.ts'
import {
  parseSaveDocument,
  serializeSaveDocument,
  storedToPattern,
} from './persistence/saveFormat.ts'
import { decodeShare, encodeShare } from './share/shareLink.ts'
import { songFromStored } from './song/song.ts'

/**
 * Activation's one promise (spec §3, R2-2): flagging marimba `pitched` costs
 * every boop already saved or already shared exactly nothing. A row that stored
 * no `pitches` reads as the anchor, the anchor is zero semitones, and zero
 * semitones is the untransposed sample - so the test is not that the audio is
 * close, it is that it is the same samples.
 *
 * The comparison is against the same document rendered through the manifest as
 * it was one commit earlier - the three new entries dropped and the registers
 * taken back off - rather than against audio captured before the epic began.
 * Marimba's sample changed in ticket 14, so comparing against that would
 * measure that ticket's swap instead (ADR 0065), which Ed accepted separately.
 */

/**
 * A save document written before the lane existed: two clips of marimba and
 * drums, a creation beside the working grid, and the pre-layering `placements`
 * form. Frozen bytes rather than something this suite builds, because what it
 * has to survive is a string already sitting in a child's `localStorage`.
 */
const PRE_EPIC_DOCUMENT =
  '{"version":1,"working":{"name":"","kitId":"launch","tempo":100,"patterns":[{"rows":[{"instrumentId":"kick","steps":"1000100010001000"},{"instrumentId":"snare","steps":"0000100000001000"},{"instrumentId":"hat","steps":"1010101010101010"},{"instrumentId":"tom","steps":"0000000000000011"},{"instrumentId":"marimba","steps":"1001001000100100"},{"instrumentId":"boop","steps":"0000000000001010"}]}],"placements":"1...............","gridClip":0},"creations":[{"name":"Tune","kitId":"launch","tempo":140,"patterns":[{"rows":[{"instrumentId":"marimba","steps":"1111111111111111"},{"instrumentId":"kick","steps":"1000000010000000"}]},{"rows":[{"instrumentId":"marimba","steps":"0101010101010101"}]}],"placements":"1122............","gridClip":1}]}'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

async function shippedKit(): Promise<Kit> {
  const raw: unknown = JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8'))
  return parseKitManifest(raw)
}

/** The three entries activation added; the rest of the manifest predates it. */
const ADDED_BY_ACTIVATION = ['trumpet', 'piano', 'doublebass']

/**
 * The manifest as it was one commit earlier: the three new entries gone and
 * every register taken back off. Both halves matter - dropping the registers
 * alone would leave the render's tail padding reading three samples that were
 * not in the kit, so the comparison would be weaker than the claim.
 */
function beforeActivation(kit: Kit): Kit {
  return {
    ...kit,
    instruments: kit.instruments
      .filter((instrument) => !ADDED_BY_ACTIVATION.includes(instrument.instrumentId))
      .map((instrument) => {
        const stripped = { ...instrument }
        delete stripped.pitched
        return stripped
      }),
  }
}

async function shippedSamples(kit: Kit): Promise<Record<string, Float32Array>> {
  const entries = await Promise.all(
    kit.instruments.map(async (instrument) => {
      const buffer = await readFile(publicDir + instrument.sound.slice(1))
      const dataIndex = buffer.indexOf('data')
      const length = buffer.readUInt32LE(dataIndex + 4) / 2
      const samples = new Float32Array(length)
      for (let i = 0; i < length; i += 1) {
        samples[i] = buffer.readInt16LE(dataIndex + 8 + i * 2) / 32767
      }
      return [instrument.instrumentId, samples] as const
    }),
  )
  return Object.fromEntries(entries)
}

describe('a boop saved before the lane existed', () => {
  it('still parses, and re-serializes to the same bytes', () => {
    const document = parseSaveDocument(PRE_EPIC_DOCUMENT)
    expect(document.working).not.toBeNull()
    expect(serializeSaveDocument(document)).toBe(PRE_EPIC_DOCUMENT)
  })

  it('reads every marimba hit at the anchor, mid-lane', async () => {
    const kit = await shippedKit()
    const document = parseSaveDocument(PRE_EPIC_DOCUMENT)
    const pattern = storedToPattern(kit, document.working!.patterns[0]!)
    const marimba = pattern.find((row) => row.instrumentId === 'marimba')!

    // The row grows no pitch data at decode: absent is the anchor, and saying
    // so is `rowPitchMasks`'s single ruling (ADR 0058).
    expect(marimba.pitches).toBeUndefined()
    expect([...rowPitchMasks(marimba)]).toEqual(
      Array.from({ length: STEPS_PER_PATTERN }, (_, step) =>
        marimba.steps[step] ? ANCHOR_PITCH_MASK : 0,
      ),
    )
  })

  it('sounds the untransposed sample, exactly as a drum row does', async () => {
    const kit = await shippedKit()
    const driver = new FakeAudioDriver()
    const engine = await createSequencerEngine({ kit, driver })
    const document = parseSaveDocument(PRE_EPIC_DOCUMENT)
    engine.setPattern(storedToPattern(kit, document.working!.patterns[0]!))

    await engine.start()
    driver.fireStep()

    // One call, with no `semitones` and no `gain`: the fake records those two
    // only when the engine asked for a pitch, so their absence is the whole
    // claim - the driver is handed what it was handed before the lane existed.
    const played = driver.played.filter((p) => p.instrumentId === 'marimba')
    expect(played).toHaveLength(1)
    expect(played[0]?.semitones).toBeUndefined()
    expect(played[0]?.gain).toBeUndefined()
    engine.dispose()
  })

  it('renders sample-identically to the build that had no lane', async () => {
    const kit = await shippedKit()
    const samples = await shippedSamples(kit)
    const document = parseSaveDocument(PRE_EPIC_DOCUMENT)
    const song = songFromStored(kit, document.creations[0]!)
    const sequence = song.clips.map((clip) => clip.pattern)
    const render = (against: Kit): Float32Array =>
      renderSequenceSamples({
        kit: against,
        sequence,
        bpm: song.bpm,
        sampleRate: 44100,
        samples,
      })

    const activated = render(kit)
    const before = render(beforeActivation(kit))

    // Same length as well as same samples: the render pads its tail by the
    // longest sample in the kit, so three new voices could have lengthened an
    // old boop's exported file without changing a note of it. They did not -
    // cymbal and marimba are both 390 ms and both predate this ticket.
    expect(activated.length).toBe(before.length)
    expect(activated.every((sample, i) => sample === before[i])).toBe(true)
  })

  it('round-trips a share link written before the lane, unchanged', () => {
    const boop = parseSaveDocument(PRE_EPIC_DOCUMENT).creations[0]!
    const token = encodeShare(boop)
    expect(decodeShare(token)).toEqual(boop)
    // The link's bytes are the stored boop's bytes, so a link sent last month
    // decodes to a document with no `pitches` on any row - the degrade path.
    expect(
      decodeShare(token)!.patterns.flatMap((pattern) => pattern.rows.map((row) => row.pitches)),
    ).toEqual([undefined, undefined, undefined])
  })
})
