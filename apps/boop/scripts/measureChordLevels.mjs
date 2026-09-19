/**
 * Measures the loudness worst case once a lane column can hold a chord, so
 * ticket 09 can re-pin `MASTER_GAIN`'s budget from numbers.
 *
 *   node apps/boop/scripts/measureChordLevels.mjs
 *
 * Raw sums, the `kitLevels.test.ts` way: every voice normalised to 0.5, hits
 * landing on every 16th at 200 bpm (the top of the tempo range), peak read off
 * the sum before any master gain. The roster and which of it is pitched come
 * from kit.json, which has carried both since ticket 10 (ADR 0065, ADR 0067).
 *
 * The worst case is searched, not assumed: every one of the 255 chords is
 * scanned per instrument, and the strongest few are then combined across the
 * four pitched instruments against the rest of the roster playing solid.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

import { SAMPLE_RATE, readWav } from './wav.mjs'

const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12]
const ANCHOR_PITCH_INDEX = 4
const PITCHES_PER_LANE = 8
const FULL_LANE_MASK = (1 << PITCHES_PER_LANE) - 1
const STEP_SECONDS = 60 / 200 / 4
const BARS = 4
/** Strongest chords per instrument carried into the joint search, plus the full lane. */
const CANDIDATES_PER_INSTRUMENT = 4

/** Candidate per-note gains for a column of n notes. */
const EXPONENTS = [0, 0.25, 0.5, 0.6, 0.75, 1]

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const manifest = JSON.parse(readFileSync(`${publicDir}kits/launch/kit.json`, 'utf8'))
const roster = manifest.instruments.map((instrument) => ({
  id: instrument.instrumentId,
  rootNote: instrument.pitched?.rootNote,
  samples: readWav(readFileSync(publicDir + instrument.sound.slice(1))),
}))
/** The pitched voices, in manifest order - ADR 0065's registers, read not listed. */
const PITCHED = roster.filter((voice) => voice.rootNote !== undefined)
const pitchedIds = new Set(PITCHED.map((p) => p.id))
const lanes = new Map(
  PITCHED.map(({ id }) => [
    id,
    [...MAJOR_SCALE_SEMITONES.keys()].map((pitchIndex) =>
      repitch(sampleFor(id), semitonesFromAnchor(pitchIndex)),
    ),
  ]),
)

process.stdout.write(
  `roster ${roster.length} instruments, ${PITCHED.length} of them pitched\n\n`,
)

process.stdout.write('baselines - one voice per instrument, no chords\n')
report('  whole roster, dense', peakOf(dense(roster.map((v) => v.samples))))

process.stdout.write('\nstrongest chords per instrument, unscaled, onset-aligned\n')
const candidates = new Map()
for (const { id } of PITCHED) {
  const ranked = rankChords(lanes.get(id))
  candidates.set(id, dedupe([...ranked.slice(0, CANDIDATES_PER_INSTRUMENT), FULL_LANE_MASK]))
  for (const mask of ranked.slice(0, CANDIDATES_PER_INSTRUMENT)) {
    process.stdout.write(
      `  ${id.padEnd(11)} ${describe(mask)} single ${peakOf(mix(notesOf(id, mask, 0))).toFixed(3)}\n`,
    )
  }
}

/** The unpitched rows, solid - the fixed part of every combination below. */
const fixed = dense(roster.filter((v) => !pitchedIds.has(v.id)).map((v) => v.samples))

process.stdout.write('\ncalibration - how much a search beats the all-rows-solid case, drums only\n')
const drumSearch = searchDrumSubset()
process.stdout.write(
  `  all ${roster.length} rows solid ${peakOf(dense(roster.map((v) => v.samples))).toFixed(3)}` +
    `   best subset (${drumSearch.on.length} rows) ${drumSearch.peak.toFixed(3)}` +
    `   pinned budget 3.1\n`,
)

process.stdout.write('\nworst case by per-note gain law, all 23 rows solid at 200 bpm\n')
process.stdout.write('  (a) every lane cell painted   (b) the loudest of 625 chord combinations\n')
for (const exponent of EXPONENTS) {
  const full = peakOf(
    dense(
      roster.flatMap((v) => (pitchedIds.has(v.id) ? notesOf(v.id, FULL_LANE_MASK, exponent) : [v.samples])),
    ),
  )
  const worst = searchWorstCase(exponent)
  process.stdout.write(
    `  ${lawName(exponent).padEnd(10)} (a) ${full.toFixed(3)} x0.3 = ${(full * 0.3).toFixed(3)}` +
      `   (b) ${worst.peak.toFixed(3)} x0.3 = ${(worst.peak * 0.3).toFixed(3)}` +
      `  ${worst.masks.map(describe).join(' ')}\n`,
  )
}

process.stdout.write('\nif every voice on disk were pitched and playing the full lane\n')
for (const exponent of EXPONENTS) {
  const lanesEverywhere = roster.flatMap(({ samples }) => {
    const gain = PITCHES_PER_LANE ** -exponent
    return [...MAJOR_SCALE_SEMITONES.keys()].map((pitchIndex) =>
      repitch(samples, semitonesFromAnchor(pitchIndex)).map((s) => s * gain),
    )
  })
  report(`  ${lawName(exponent)}`, peakOf(dense(lanesEverywhere)))
}

process.stdout.write('\nhow a chord sits against one note, worst chord of each size (peak dB / RMS dB)\n')
for (const exponent of [0.5, 0.75, 1]) {
  process.stdout.write(`\n  ${lawName(exponent)}\n    notes${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => String(n).padStart(13)).join('')}\n`)
  for (const { id } of PITCHED) {
    const one = mix(notesOf(id, 1 << ANCHOR_PITCH_INDEX, 0))
    const row = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
      const chord = mix(notesOf(id, loudestChordOfSize(id, n), exponent))
      const peakDb = 20 * Math.log10(peakOf(chord) / peakOf(one))
      const rmsDb = 20 * Math.log10(rmsOf(chord) / rmsOf(one))
      return `${peakDb.toFixed(1).padStart(6)}/${rmsDb.toFixed(1).padStart(5)}`
    })
    process.stdout.write(`    ${id.padEnd(11)}${row.join(' ')}\n`)
  }
}

function lawName(exponent) {
  if (exponent === 0) return 'none (1)'
  if (exponent === 1) return '1/n'
  return `1/n^${exponent}`
}

function rmsOf(samples) {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

/** The n-note chord of a lane whose unscaled onset-aligned sum peaks highest. */
function loudestChordOfSize(id, n) {
  const lane = lanes.get(id)
  let worst = { mask: 0, peak: -1 }
  for (let mask = 1; mask <= FULL_LANE_MASK; mask += 1) {
    if (countNotes(mask) !== n) continue
    const notes = []
    for (let bit = 0; bit < PITCHES_PER_LANE; bit += 1) {
      if (mask & (1 << bit)) notes.push(lane[bit])
    }
    const peak = peakOf(mix(notes))
    if (peak > worst.peak) worst = { mask, peak }
  }
  return worst.mask
}

function sampleFor(id) {
  const found = roster.find((v) => v.id === id)
  if (!found) throw new Error(`no sample for ${id}`)
  return found.samples
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

function countNotes(mask) {
  let n = 0
  for (let bit = 0; bit < PITCHES_PER_LANE; bit += 1) if (mask & (1 << bit)) n += 1
  return n
}

function describe(mask) {
  return `0x${mask.toString(16).padStart(2, '0')}(${countNotes(mask)})`
}

function dedupe(masks) {
  return [...new Set(masks)]
}

/** The notes of a column, each at the law's per-note gain. */
function notesOf(id, mask, exponent) {
  const lane = lanes.get(id)
  const gain = countNotes(mask) ** -exponent
  const notes = []
  for (let bit = 0; bit < PITCHES_PER_LANE; bit += 1) {
    if (mask & (1 << bit)) notes.push(lane[bit].map((s) => s * gain))
  }
  return notes
}

/** Every chord of a lane, unscaled, ordered by how high its onset-aligned sum peaks. */
function rankChords(lane) {
  const scored = []
  for (let mask = 1; mask <= FULL_LANE_MASK; mask += 1) {
    const notes = []
    for (let bit = 0; bit < PITCHES_PER_LANE; bit += 1) {
      if (mask & (1 << bit)) notes.push(lane[bit])
    }
    scored.push({ mask, peak: peakOf(mix(notes)) })
  }
  return scored.sort((a, b) => b.peak - a.peak).map((s) => s.mask)
}

/**
 * The loudest combination of candidate chords, all four lanes solid at 200 bpm
 * on top of the rest of the roster. Nested so each level's partial sum is built
 * once rather than once per leaf.
 */
function searchWorstCase(exponent) {
  const trains = PITCHED.map(({ id }) =>
    candidates.get(id).map((mask) => ({ mask, train: dense(notesOf(id, mask, exponent)) })),
  )
  let worst = { peak: 0, masks: [] }
  for (const a of trains[0]) {
    const sumA = add(fixed, a.train)
    for (const b of trains[1]) {
      const sumB = add(sumA, b.train)
      for (const c of trains[2]) {
        const sumC = add(sumB, c.train)
        for (const d of trains[3]) {
          const peak = peakOf(add(sumC, d.train))
          if (peak > worst.peak) worst = { peak, masks: [a.mask, b.mask, c.mask, d.mask] }
        }
      }
    }
  }
  return worst
}

/**
 * The loudest subset of the roster's rows, by hill-climbing on/off flips. The
 * pinned budget was measured with every row solid and no search at all, so this
 * says how much stricter a searched worst case is.
 */
function searchDrumSubset() {
  const trains = roster.map((v) => dense([v.samples]))
  const length = Math.max(...trains.map((t) => t.length))
  let on = roster.map((_, i) => i)
  let best = peakOf(sumOf(trains, on, length))
  for (let round = 0; round < 8; round += 1) {
    let improved = false
    for (let i = 0; i < trains.length; i += 1) {
      const next = on.includes(i) ? on.filter((j) => j !== i) : [...on, i]
      if (next.length === 0) continue
      const peak = peakOf(sumOf(trains, next, length))
      if (peak > best) {
        best = peak
        on = next
        improved = true
      }
    }
    if (!improved) break
  }
  return { peak: best, on }
}

function sumOf(trains, indices, length) {
  const out = new Float32Array(length)
  for (const i of indices) {
    const train = trains[i]
    for (let s = 0; s < train.length; s += 1) out[s] += train[s]
  }
  return out
}

function mix(tracks) {
  const out = new Float32Array(Math.max(...tracks.map((t) => t.length)))
  for (const track of tracks) for (let i = 0; i < track.length; i += 1) out[i] += track[i]
  return out
}

function add(a, b) {
  const out = new Float32Array(Math.max(a.length, b.length))
  out.set(a)
  for (let i = 0; i < b.length; i += 1) out[i] += b[i]
  return out
}

/** Every track landing on every 16th of BARS bars at 200 bpm. */
function dense(tracks) {
  const stepSamples = Math.round(STEP_SECONDS * SAMPLE_RATE)
  const steps = 16 * BARS
  const out = new Float32Array(steps * stepSamples + Math.max(...tracks.map((t) => t.length)))
  for (let step = 0; step < steps; step += 1) {
    const offset = step * stepSamples
    for (const track of tracks) {
      for (let i = 0; i < track.length; i += 1) out[offset + i] += track[i]
    }
  }
  return out
}

function peakOf(samples) {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  return peak
}

function report(label, peak) {
  process.stdout.write(
    `${label.padEnd(54)} ${peak.toFixed(3)} raw  x0.3 = ${(peak * 0.3).toFixed(3)}\n`,
  )
}
