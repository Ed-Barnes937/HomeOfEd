/**
 * Renders what a pitched lane sounds like, for the ear check the activation
 * merge is gated on.
 *
 *   node apps/boop/scripts/renderLaneAudition.mjs           # to a temp dir
 *   node apps/boop/scripts/renderLaneAudition.mjs ~/Desktop
 *
 * One WAV per instrument walking its lane up and back down, one ensemble WAV
 * of all of them together, and a printed repitch report. The roster and its
 * registers come from `kit.json`, which has carried them since ticket 10.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

import { SAMPLE_RATE, readWav, wav } from './wav.mjs'

/** The lane: one major octave, do to high do, with "so" the untransposed root. */
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12]
const ANCHOR_PITCH_INDEX = 4
const SOLFEGE = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti', 'high do']

const BPM = 120
const kitDir = fileURLToPath(new URL('../public/kits/launch/', import.meta.url))
const outDir = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'boop-lane-'))
mkdirSync(outDir, { recursive: true })

const stepSeconds = 60 / BPM / 2
const walk = [...MAJOR_SCALE_SEMITONES.keys(), ...[...MAJOR_SCALE_SEMITONES.keys()].reverse()]

/** The pitched roster, in manifest order. Every root is a G: the "so" of C major. */
const voices = JSON.parse(readFileSync(`${kitDir}kit.json`, 'utf8'))
  .instruments.filter((instrument) => instrument.pitched !== undefined)
  .map((instrument) => ({
    id: instrument.instrumentId,
    rootNote: instrument.pitched.rootNote,
    samples: readWav(readFileSync(kitDir + instrument.sound.replace('/kits/launch/', ''))),
  }))

for (const { id, samples } of voices) {
  const track = new Float32Array(Math.round((walk.length + 2) * stepSeconds * SAMPLE_RATE))
  walk.forEach((pitchIndex, n) => {
    addAt(track, repitch(samples, semitonesFromAnchor(pitchIndex)), n * stepSeconds)
  })
  writeFileSync(join(outDir, `${id}-octave.wav`), wav(track))
}

const ensemble = new Float32Array(Math.round(18 * stepSeconds * SAMPLE_RATE))
// A little C major phrase, then the whole lane as one chord.
const phrase = [0, 2, 4, 7, 4, 2, 0]
voices.forEach(({ samples }, voiceIndex) => {
  phrase.forEach((pitchIndex, n) => {
    addAt(ensemble, repitch(samples, semitonesFromAnchor(pitchIndex)), (n + voiceIndex) * stepSeconds)
  })
  for (const pitchIndex of MAJOR_SCALE_SEMITONES.keys()) {
    addAt(ensemble, repitch(samples, semitonesFromAnchor(pitchIndex)), 12 * stepSeconds)
  }
})
writeFileSync(join(outDir, 'ensemble.wav'), wav(scale(ensemble, 0.3)))

process.stdout.write(`wrote ${voices.length + 1} files to ${outDir}\n\n`)
process.stdout.write('repitch report - what each lane cell does to the root sample\n')
for (const { id, rootNote, samples } of voices) {
  const rootMidi = noteNameToMidi(rootNote)
  process.stdout.write(`\n  ${id} (root ${rootNote}, ${(samples.length / SAMPLE_RATE) * 1000 | 0}ms)\n`)
  for (const pitchIndex of MAJOR_SCALE_SEMITONES.keys()) {
    const semitones = semitonesFromAnchor(pitchIndex)
    const pitched = repitch(samples, semitones)
    const ms = (pitched.length / SAMPLE_RATE) * 1000
    process.stdout.write(
      `    ${SOLFEGE[pitchIndex].padEnd(8)} ${String(semitones).padStart(3)}st  ` +
        `${noteName(rootMidi + semitones).padEnd(4)} ${ms.toFixed(0).padStart(4)}ms  ` +
        `retrigger ${retriggerBuildup(pitched).toFixed(2)}x\n`,
    )
  }
}

function semitonesFromAnchor(pitchIndex) {
  return MAJOR_SCALE_SEMITONES[pitchIndex] - MAJOR_SCALE_SEMITONES[ANCHOR_PITCH_INDEX]
}

/** What `playbackRate = 2^(semitones/12)` does to a buffer, linearly interpolated. */
function repitch(samples, semitones) {
  const rate = Math.pow(2, semitones / 12)
  const out = new Float32Array(Math.floor(samples.length / rate))
  for (let i = 0; i < out.length; i += 1) {
    const at = i * rate
    const low = Math.floor(at)
    const frac = at - low
    out[i] = (samples[low] ?? 0) * (1 - frac) + (samples[low + 1] ?? 0) * frac
  }
  return out
}

/** The kitLevels rule, applied to a repitched buffer: 8 hits on 200bpm 16ths. */
function retriggerBuildup(samples) {
  const stepSamples = Math.round((60 / 200 / 4) * SAMPLE_RATE)
  const train = new Float32Array(stepSamples * 8 + samples.length)
  for (let hit = 0; hit < 8; hit += 1) addAt(train, samples, (hit * stepSamples) / SAMPLE_RATE)
  return peakOf(train) / peakOf(samples)
}

function addAt(track, samples, seconds) {
  const offset = Math.round(seconds * SAMPLE_RATE)
  for (let i = 0; i < samples.length && offset + i < track.length; i += 1) {
    track[offset + i] += samples[i]
  }
}

function peakOf(samples) {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  return peak
}

function scale(samples, factor) {
  return samples.map((s) => s * factor)
}

function noteNameToMidi(name) {
  const [, letter, octave] = /^([A-G])(-1|[0-9])$/.exec(name)
  return (Number(octave) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
}

function noteName(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}
