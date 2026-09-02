import { useCallback, useEffect, useRef, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { blankPattern, DEFAULT_BPM, type Pattern } from '../engine/sequencerEngine.ts'
import { boopFilename } from '../export/boopFilename.ts'
import { exportBoopWav, navigatorExportTarget } from '../export/exportAction.ts'
import { DEFAULT_SAMPLE_RATE, renderBoopWav } from '../export/renderBoopWav.ts'
import { webAudioSampleDecoder } from '../export/sampleDecoder.ts'
import { BoopsPanel } from '../features/boops/BoopsPanel.tsx'
import { ClipControl } from '../features/clips/ClipControl.tsx'
import { ClipEditorCard } from '../features/clips/ClipEditorCard.tsx'
import { ClipHeader } from '../features/clips/ClipHeader.tsx'
import { ClipLauncher } from '../features/clips/ClipLauncher.tsx'
import { clipTint } from '../features/clips/clipTints.ts'
import { Grid, type GridViewProps } from '../features/grid/Grid.tsx'
import { ROW_COLOR_VARS } from '../features/grid/instrumentColors.ts'
import { PhoneGrid } from '../features/grid/PhoneGrid.tsx'
import { usePlayheadMotion } from '../features/grid/usePlayheadMotion.ts'
import { HintSheet } from '../features/hints/HintSheet.tsx'
import { InstrumentPicker } from '../features/picker/InstrumentPicker.tsx'
import { NewClipPicker } from '../features/picker/NewClipPicker.tsx'
import { firstVisitSong, samplePattern, type SampleClip } from '../features/picker/sampleClips.ts'
import {
  playheadReadout,
  type SongPlayheadView,
} from '../features/playhead/songPlayhead.ts'
import { PhoneSongBar } from '../features/songbar/PhoneSongBar.tsx'
import { SongBar } from '../features/songbar/SongBar.tsx'
import { PhoneBar } from '../features/topbar/PhoneBar.tsx'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { isEditableTarget } from '../isEditableTarget.ts'
import { MAX_CLIPS, WORKING_NAME, type StoredBoop } from '../persistence/saveFormat.ts'
import { useWorkingSong } from '../persistence/useWorkingSong.ts'
import { afterEdit, type LoadedBoop } from '../savedState.ts'
import { prefersShareSheet } from '../share/shareAction.ts'
import { buildShareUrl, clearShareHash, decodeShareHash } from '../share/shareLink.ts'
import {
  activeClip,
  addClip,
  deleteClip,
  moveClip,
  removeRow,
  renameClip,
  singleClipSong,
  songFromStored,
  storedBoopFromSong,
  swapRowInstrument,
  togglePlacement,
  withActivePattern,
  withBpm,
  type Song,
} from '../song/song.ts'
import { createSongConductor, type SongConductor } from '../song/songConductor.ts'
import { scrubToBar, scrubToStep } from '../song/songScrub.ts'
import {
  BARS_PER_POSITION,
  STEPS_PER_BAR,
  barAt,
  clampGlobalBar,
  globalBarAtCell,
  globalBarAtFraction,
  globalBarOfTick,
  songTimeline,
} from '../song/songTimeline.ts'
import { useIsPhone } from '../useIsPhone.ts'
import styles from './HomePage.module.scss'

/** No placements at all — the timeline of a song that has not loaded yet. */
const NO_PLACEMENTS: readonly (readonly number[])[] = []

/**
 * The same rows with nothing painted — what "Clear grid" leaves behind. It
 * keeps the clip's *rows*: since ADR 0041 those are the child's own choice of
 * instruments, and clearing the beats is not a reason to take them away.
 */
function clearedPattern(pattern: Pattern): Pattern {
  return pattern.map((row) => ({
    instrumentId: row.instrumentId,
    steps: row.steps.map(() => false),
  }))
}

/**
 * The whole app: top bar, the 6x16 grid, and play/pause. The working state is
 * a *song* (ticket 14) — clips, placements, one bpm, and the active clip the
 * grid edits. The engine holds only that active clip's pattern and the tempo;
 * they are the source of truth for what sounds, mirrored into the song after
 * every edit so a toggle re-renders and the autosave sees the whole song.
 */
export function HomePage() {
  const engine = useEngine()
  const [song, setSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  // The saved boop the grid came from, and whether it has since diverged
  // (ticket 31). `null` — a share link, a fresh or cleared grid — reads
  // "Not saved yet": neither is a row in "My boops". Not restored on reload;
  // the indicator describes this session's loading and saving, not the
  // autosave, which never loses anything.
  const [loaded, setLoaded] = useState<LoadedBoop | null>(null)
  // Bumped whenever a whole clip lands on the grid so it can stagger the
  // cells landing across columns instead of popping in all at once.
  const [loadToken, setLoadToken] = useState(0)
  // "My boops" is open or it isn't. The phone chrome's save icon (ticket 27)
  // opens the same panel: since ticket 32 the save form is always on and
  // prefilled, so "open it" *is* "get ready to save".
  const [boopsOpen, setBoopsOpen] = useState(false)
  // The "+ New clip" picker (ticket 17): Blank first, then the sample clips.
  const [pickerOpen, setPickerOpen] = useState(false)
  /**
   * Which row the instrument picker is open on (boop-instruments ticket 05), or
   * `null` for closed. A row *index*: the grid's rows are identified by
   * position (their hues are positional, and the mutations take an index), so
   * the dialog stays pointed at the same row while its sound swaps underneath.
   */
  const [instrumentRow, setInstrumentRow] = useState<number | null>(null)
  /**
   * Whether the clip editor card is open (screenspace ticket 03). It lives
   * here rather than in the card because there are two routes in — the dock's
   * launcher and a tap on any clip chip in the song bar — and the song bar is
   * the page's, not the card's.
   */
  const [clipOpen, setClipOpen] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const motion = usePlayheadMotion(engine)
  // Below the tablet layout's 1024px floor the grid would have to shrink, so
  // the pinned-rail scroll window takes over (ticket 27) — chrome and grid
  // both, since the phone's actions live in the "⋯" menu. At 1024px and up
  // the child gets the clip-lanes design (tickets 15/20): clip header, clip
  // control in the well, the pinned song bar — and no transport bar. The
  // tablet band (1024–1279) is the laptop design with the lane grid shrunk
  // to fit the column (spec §4, variant E) — a CSS difference, not a layout
  // switch. The phone (ticket 21, spec §5 — variant B) keeps its pinned
  // transport (clip play and Speed) and puts the song bar in the scrolling
  // region below the grid well, on the step window's geometry.
  const phone = useIsPhone()

  // A shared boop is decoded on the first render, before the first restore,
  // and wins over the autosaved grid. Held in a ref so the value survives the
  // fragment being cleared below — decoding again would then find nothing.
  const sharedBoop = useRef<StoredBoop | null | undefined>(undefined)
  sharedBoop.current ??= decodeShareHash(window.location.hash)

  // The restore hands back the whole autosaved song, its active clip and tempo
  // already in the engine; adopting it here is what un-gates the render below.
  const restoredSong = useWorkingSong(engine, song, sharedBoop.current, firstVisitSong)

  useEffect(() => {
    if (restoredSong) setSong(restoredSong)
  }, [restoredSong])

  // Tap-time reads (share, save) go through the ref so their callbacks keep a
  // stable identity while always seeing the song as it stands.
  const songRef = useRef<Song | null>(null)
  songRef.current = song

  useEffect(() => {
    if (sharedBoop.current) clearShareHash(window.location, window.history)
  }, [])

  // --- Song playback (ticket 16, spec §9) ---

  const [songPlaying, setSongPlaying] = useState(false)
  // Where the playhead sits, in global bars (boop-playhead ticket 04). A
  // persistent fact about the boop rather than a playback artefact (spec §1):
  // the draw channel moves it while the song plays, a scrub moves it by hand,
  // and a stop leaves it exactly where it was. Page-lifetime view state — never
  // saved, never shared (spec §7.3).
  const [songBar, setSongBar] = useState(0)
  const conductorRef = useRef<SongConductor | null>(null)
  // True whenever the song play is on — including an all-empty song, which
  // plays the grid clip and needs no conductor (ADR 0032).
  const songModeRef = useRef(false)

  // The global-bar axis of the song as it stands (ticket 02) — cheap enough to
  // derive every render: 16 placements in, the placed ones out. The ref is for
  // the draw-beat listener below, which reads it outside React's render.
  const timeline = songTimeline(song?.placements ?? NO_PLACEMENTS)
  const timelineRef = useRef(timeline)
  timelineRef.current = timeline

  // The bar the playhead is on, clamped to the song as it stands so a placement
  // change can shorten the timeline under it without the marker drifting.
  // `null` means only "there is nothing to point at" — a song with no
  // placements has no timeline — and no longer means "we are stopped".
  const playheadBar = timeline.barCount === 0 ? null : clampGlobalBar(timeline, songBar)
  const playheadAt = playheadBar === null ? null : barAt(timeline, playheadBar)
  // The scrub handlers are held across a whole drag, so they read the bar from a
  // ref rather than closing over it and going stale between pointer moves.
  const songBarRef = useRef(songBar)
  songBarRef.current = songBar

  // The step a scrub put the playhead on (boop-playhead ticket 05). Stopped,
  // the draw channel is silent, so a scrub is the only thing that can move the
  // column and the grid's under-playhead highlight — the silent preview of
  // spec §4. The next drawn beat drops it: from then on the engine is the
  // authority again.
  const [scrubStep, setScrubStep] = useState<number | null>(null)

  // The playhead's bar while the song plays, from the draw channel and nowhere
  // else: the schedule runs a lookahead ahead of the sound (ADR 0024), so a
  // tick read at schedule time would move the playhead — and with it the grid's
  // clip — before that bar was audible. Song mode only: a clip loop leaves the
  // song's position alone.
  useEffect(() => {
    if (!engine) return
    return engine.onDrawBeat(({ tick }) => {
      // An all-empty song plays the grid clip with no conductor (ADR 0032), and
      // its ticks belong to no timeline — leave the bar where it was rather than
      // resetting it to the start of a song that has nothing in it.
      // Clear any scrub preview — returning the same value when it is already
      // clear, so a drawn beat per step does not re-render for nothing.
      setScrubStep((step) => (step === null ? step : null))
      if (!songModeRef.current || timelineRef.current.barCount === 0) return
      setSongBar(globalBarOfTick(timelineRef.current, tick))
    })
  }, [engine])

  /**
   * Draw time: this position is audible now. The grid switches to its clip — a
   * view change like tapping its chip, never an edit, and never an engine
   * write: the conductor owns the engine's pattern while the song plays. A
   * layered position sounds several clips at once but the grid shows one: its
   * topmost lane, so a single-clip position behaves exactly as it always has.
   */
  const onSoundingPosition = useCallback((position: number) => {
    const current = songRef.current
    if (!current) return
    const clipIndex = current.placements[position]?.[0]
    if (clipIndex === undefined || clipIndex === current.activeClipIndex) return
    const next = { ...current, activeClipIndex: clipIndex }
    songRef.current = next
    setSong(next)
  }, [])

  /**
   * Leave song mode: drop the conductor and re-sync the engine to the clip on
   * the grid. The conductor swaps one lookahead ahead of the sound, so at the
   * moment the song ends the engine may already hold the *next* position's
   * clip — the resync makes "the clip on the grid" true again before any edit
   * reads the engine back. Does not touch the transport; callers decide
   * whether playback stops or carries on as clip play.
   *
   * The playhead's bar is deliberately left alone: since ticket 04 stopping the
   * song no longer erases where you were, so the next play starts from there.
   */
  const leaveSongMode = useCallback(() => {
    if (!songModeRef.current) return
    songModeRef.current = false
    conductorRef.current?.dispose()
    conductorRef.current = null
    setSongPlaying(false)
    const current = songRef.current
    if (engine && current) engine.setPattern(activeClip(current).pattern)
  }, [engine])

  /**
   * Any mutation while the song plays means "you are now editing, not
   * listening" (spec §9): stop playback outright. The explicit `leaveSongMode`
   * covers the sliver where song mode is on but `start()` is still unlocking,
   * when `engine.stop()` would be a no-op and emit nothing.
   */
  const stopSongPlayback = useCallback(() => {
    if (!songModeRef.current) return
    engine?.stop()
    leaveSongMode()
  }, [engine, leaveSongMode])

  useEffect(() => {
    if (!engine) return
    setIsPlaying(engine.isPlaying())
    return engine.onTransport((event) => {
      if (event.type === 'started') setIsPlaying(true)
      if (event.type === 'stopped') {
        setIsPlaying(false)
        // However the transport stopped — the stop buttons, spacebar, an
        // audio interruption — song mode does not outlive it.
        leaveSongMode()
      }
      if (event.type === 'tempoChanged') setSong((s) => (s ? withBpm(s, event.bpm) : s))
    })
  }, [engine, leaveSongMode])

  /** Everything the app calls a change (ADR 0031, as amended): any mutation of the song. */
  const markEdited = useCallback(() => {
    setLoaded(afterEdit)
  }, [])

  /**
   * The path a song mutation takes: apply it, and — if it really changed
   * something — mark the loaded boop edited. A refused no-op (deleting the
   * last clip, adding past the cap) is not a mutation and marks nothing.
   * Tempo is the one mutation that arrives elsewhere (the engine's
   * `tempoChanged` event above); `changeTempo` marks edited itself.
   */
  const updateSong = useCallback(
    (mutate: (song: Song) => Song): Song | null => {
      // Every song mutation stops song playback first (spec §9). This runs
      // before we know whether `mutate` is a refused no-op, but those hide
      // behind disabled buttons — the stop can't misfire in practice.
      stopSongPlayback()
      const current = songRef.current
      if (!current) return null
      const next = mutate(current)
      if (next === current) return null
      songRef.current = next
      setSong(next)
      markEdited()
      return next
    },
    [markEdited, stopSongPlayback],
  )

  /**
   * `updateSong`'s sibling, and the only other path to the song (spec §2): a
   * scrub. It marks nothing edited and stops nothing, because moving the
   * playhead is listening rather than editing — and it never writes `songRef`,
   * because the song has not changed. Stopped, it is silent: the state moves and
   * the transport stays where it was, so only the next play sounds the target.
   */
  const scrubSongTo = useCallback(
    (globalBar: number) => {
      if (!engine) return null
      const bar = scrubToBar(
        { engine, conductor: conductorRef.current, timeline: timelineRef.current },
        globalBar,
      )
      if (bar !== null) setSongBar(bar)
      return bar
    },
    [engine],
  )

  /**
   * A *gesture's* scrub to a bar — the strips' arrows and Home. The same seek,
   * plus the column: stopped there is no draw beat to move it, so the bar's own
   * first step is the silent preview of where the scrub landed (spec §4).
   * `toggleSong`'s own seek deliberately does not do this — nothing has sounded
   * yet at that point, and the column means "the last step that did".
   */
  const scrubSongToBar = useCallback(
    (globalBar: number) => {
      const bar = scrubSongTo(globalBar)
      if (bar !== null) setScrubStep((bar % BARS_PER_POSITION) * STEPS_PER_BAR)
    },
    [scrubSongTo],
  )

  /**
   * The song strip's own gesture: a cell of the strip and the bar inside it.
   * Empty cells are drawn but not on the timeline, so the resolution clamps
   * rather than reaching one (spec §4).
   */
  const scrubSongToCell = useCallback(
    (position: number, bar: number) => {
      const globalBar = globalBarAtCell(timelineRef.current, position, bar)
      if (globalBar !== null) scrubSongToBar(globalBar)
    },
    [scrubSongToBar],
  )

  /**
   * The phone song band's gesture (ticket 06): how far across the band the
   * pointer sits. The band is one continuous track over the song's *real*
   * length, not the laptop strip's 16 drawn slots, so a fraction of it is the
   * whole answer and there is no empty cell to resolve (spec §7.2).
   */
  const scrubSongToFraction = useCallback(
    (fraction: number) => {
      scrubSongToBar(globalBarAtFraction(timelineRef.current, fraction))
    },
    [scrubSongToBar],
  )

  /**
   * The clip rail's gesture: a step of the clip on the grid. The bar moves with
   * it — a step names a bar — so the strip and the readout follow a rail drag.
   */
  const scrubClipToStep = useCallback(
    (step: number) => {
      if (!engine) return
      const landed = scrubToStep(
        { engine, conductor: conductorRef.current, timeline: timelineRef.current },
        songBarRef.current,
        step,
      )
      setSongBar(landed.globalBar)
      setScrubStep(landed.step)
    },
    [engine],
  )

  const toggleCell = useCallback(
    (instrumentId: string, step: number) => {
      if (!engine) return
      // Stop the song before reading the engine back: while it plays the
      // engine may already hold the next position's clip, and the stop's
      // resync is what makes this read the clip on the grid.
      stopSongPlayback()
      const row = engine.getPattern().find((r) => r.instrumentId === instrumentId)
      const on = row?.steps[step] !== true
      engine.setCell(instrumentId, step, on)
      updateSong((s) => withActivePattern(s, engine.getPattern()))
    },
    [engine, stopSongPlayback, updateSong],
  )

  const togglePlay = useCallback(() => {
    if (!engine) return
    if (engine.isPlaying()) {
      engine.stop()
    } else {
      void engine.start()
    }
  }, [engine])

  /**
   * "Play this clip" (the clip control). While the song plays it takes over:
   * the song stops and the clip on the grid loops from its first step —
   * "starting either play stops the other" (spec §9). The transport really
   * does stop, because play always starts at the top (ticket 22): a small
   * audible gap is the price of one rule with no exceptions. Otherwise it is
   * the plain play/stop.
   */
  const toggleClipPlay = useCallback(() => {
    if (!engine) return
    if (songModeRef.current) {
      stopSongPlayback()
      void engine.start()
      return
    }
    togglePlay()
  }, [engine, stopSongPlayback, togglePlay])

  /**
   * The song play button (spec §9): placements left to right, looping, empty
   * positions skipped. An all-empty song plays the clip on the grid — "an
   * empty song playing the grid clip is today's behaviour" (ADR 0032) — so no
   * conductor and no ring, but the button still reads Stop. Starting the song
   * while the clip loops stops the transport first (ticket 22), so nothing of
   * that run carries over.
   *
   * What the song then starts from is the playhead, not the first position:
   * the bar outlives a stop since ticket 04 and the strips draw it where it
   * sits, so this is a place a child can see and chose, not a remembered
   * offset. That is what supersedes boop-loops ticket 16's accepted limit
   * about resuming mid-song. The scrub therefore has to follow the stop, since
   * the stop is the rewind.
   */
  const toggleSong = useCallback(() => {
    const current = songRef.current
    if (!engine || !current) return
    if (songModeRef.current) {
      stopSongPlayback()
      return
    }
    // Before song mode, never after: the stop's transport event runs
    // `leaveSongMode`, which would tear the conductor below straight back down.
    engine.stop()
    songModeRef.current = true
    setSongPlaying(true)
    if (current.placements.some((clipIndices) => clipIndices.length > 0)) {
      conductorRef.current = createSongConductor(
        engine,
        current.clips.map((clip) => clip.pattern),
        current.placements,
        onSoundingPosition,
      )
      // A fresh conductor sits at the first position, so send it to the playhead
      // before the transport starts — the same move a scrub makes.
      scrubSongTo(songBar)
    }
    void engine.start()
  }, [engine, onSoundingPosition, scrubSongTo, songBar, stopSongPlayback])

  // Spacebar toggles play from anywhere on the page (spec: "Transport &
  // tempo"). `preventDefault` always fires for a non-editable target, so
  // Space never scrolls the page and never re-triggers whatever button
  // happens to be focused — the boop rename field is the one exemption,
  // where Space must still type a space.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      togglePlay()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [togglePlay])

  const changeTempo = useCallback(
    (nextBpm: number) => {
      if (!engine) return
      engine.setTempo(nextBpm)
      // Tempo is part of a saved boop, so a boop whose tempo you moved really
      // does differ from the one in the list (ticket 31).
      markEdited()
    },
    [engine, markEdited],
  )

  /** Read at tap time, so the link always carries the whole song as it stands. */
  const getShareUrl = useCallback(() => {
    if (!engine || !songRef.current) return window.location.href
    return buildShareUrl(
      window.location,
      storedBoopFromSong(engine.kit, songRef.current, WORKING_NAME),
    )
  }, [engine])

  /** Read at tap time (the Save button inside "My boops"), same reasoning as `getShareUrl`. */
  const getWorkingBoop = useCallback(
    (name: string) => {
      if (!engine || !songRef.current) throw new Error('engine not ready')
      return storedBoopFromSong(engine.kit, songRef.current, name)
    },
    [engine],
  )

  /**
   * Export one *saved* boop as a WAV (ticket 34): an offline render of that
   * row's whole song — placements one pass, or the grid clip's 4 bars when
   * nothing is placed (ticket 19) — then the share sheet on mobile or a
   * download on desktop. The only export path — there is no top-bar link, so
   * exporting means "export this saved boop". The double-tap guard lives on
   * the row, in `BoopsPanel`.
   */
  const exportBoop = useCallback(
    async (boop: StoredBoop) => {
      if (!engine) return
      const kit = engine.kit
      const context = new OfflineAudioContext(1, 1, DEFAULT_SAMPLE_RATE)
      const blob = await renderBoopWav({
        kit,
        song: songFromStored(kit, boop),
        decode: webAudioSampleDecoder(context),
      })
      await exportBoopWav(
        blob,
        boopFilename(boop.name),
        navigatorExportTarget(navigator, document, prefersShareSheet()),
      )
    },
    [engine],
  )

  // --- The clip-lanes handlers (tickets 15/20, laptop and tablet) ---

  /** "New boop" as a plain reset (spec §7): one blank clip, default tempo, no confirm. */
  const newBoop = useCallback(() => {
    if (!engine) return
    stopSongPlayback()
    engine.setPattern(blankPattern(engine.kit))
    engine.setTempo(DEFAULT_BPM)
    const fresh = singleClipSong(engine.getPattern(), engine.getTempo())
    songRef.current = fresh
    setSong(fresh)
    // The reset drops the loaded boop — this is a new boop, not an edit.
    setLoaded(null)
    setLoadToken((token) => token + 1)
  }, [engine, stopSongPlayback])

  /**
   * Tapping a chip puts that clip on the grid — a view change, not an edit.
   * While the song plays it also stops it (spec §9: "you are now editing, not
   * listening"), even when the chip is already the active clip.
   */
  const selectClip = useCallback(
    (index: number) => {
      if (!engine) return
      stopSongPlayback()
      const current = songRef.current
      if (!current || index === current.activeClipIndex || !current.clips[index]) return
      const next = { ...current, activeClipIndex: index }
      engine.setPattern(activeClip(next).pattern)
      songRef.current = next
      setSong(next)
      setLoadToken((token) => token + 1)
    },
    [engine, stopSongPlayback],
  )

  /**
   * A chip tap: the second route into the editor (screenspace ticket 03). It
   * puts that clip on the grid *and* opens the card, including when the chip
   * is already the active one — a child who taps the thing they want to change
   * expects to be changing it. Selecting without opening is not an action the
   * app offers any more: the active clip only matters to the grid.
   */
  const editClip = useCallback(
    (index: number) => {
      selectClip(index)
      setClipOpen(true)
    },
    [selectClip],
  )

  /**
   * Adds a clip and puts it on the grid; `pattern` is blank, a sample clip's,
   * or the copied clip's. `name` is a sample clip's plain label — without one
   * the clip takes the automatic "Clip N". Returns the song the clip landed
   * in, or `null` for a refused no-op at the cap.
   */
  const addClipToSong = useCallback(
    (pattern: (song: Song) => Pattern, name?: string): Song | null => {
      if (!engine) return null
      const next = updateSong((s) => addClip(s, pattern(s), name))
      if (!next) return null
      engine.setPattern(activeClip(next).pattern)
      setLoadToken((token) => token + 1)
      return next
    },
    [engine, updateSong],
  )

  /**
   * The picker's landing (spec §6): the choice becomes a new clip, on the
   * grid, unplaced. Blank keeps the automatic "Clip N"; a sample clip lands
   * under its own label. Neither route starts the transport — adding a clip
   * is an edit, and the child decides when sound happens.
   */
  const pickClip = useCallback(
    (sample: SampleClip | null) => {
      setPickerOpen(false)
      if (!engine) return
      const kit = engine.kit
      if (!sample) {
        addClipToSong(() => blankPattern(kit))
        return
      }
      addClipToSong(() => samplePattern(kit, sample.rows), sample.label)
    },
    [addClipToSong, engine],
  )

  /** "Make a copy": the active clip's pattern into a new clip, selected. */
  const copyClip = useCallback(
    () => addClipToSong((s) => activeClip(s).pattern),
    [addClipToSong],
  )

  /** "Delete clip" deletes the clip on the grid; the grid lands on a neighbour. */
  const deleteActiveClip = useCallback(() => {
    if (!engine) return
    const next = updateSong((s) => deleteClip(s, s.activeClipIndex))
    if (!next) return
    engine.setPattern(activeClip(next).pattern)
    setLoadToken((token) => token + 1)
  }, [engine, updateSong])

  const renameActiveClip = useCallback(
    (name: string) => {
      updateSong((s) => renameClip(s, s.activeClipIndex, name))
    },
    [updateSong],
  )

  /**
   * A lane reorder (ticket 18): chip drag or Ctrl/Cmd+Arrow. Placements are
   * rewritten in the same update (spec §8) and the grid's clip travels, so
   * the engine's pattern is untouched — nothing to resync.
   */
  const moveClipLane = useCallback(
    (from: number, to: number) => {
      updateSong((s) => moveClip(s, from, to))
    },
    [updateSong],
  )

  const togglePlacementAt = useCallback(
    (clipIndex: number, position: number) => {
      updateSong((s) => togglePlacement(s, clipIndex, position))
    },
    [updateSong],
  )

  /**
   * "Clear grid" is clip-scoped and an *edit* (spec §7): it empties only the
   * clip on the grid and keeps the loaded boop. One behaviour at every width —
   * the clip control at ≥1024, the "⋯" menu (behind its confirm) on the phone.
   */
  const clearClip = useCallback(() => {
    if (!engine) return
    // Stop the song before blanking the engine — `leaveSongMode`'s resync
    // would otherwise overwrite the blank with the active clip again.
    stopSongPlayback()
    engine.setPattern(clearedPattern(engine.getPattern()))
    updateSong((s) => withActivePattern(s, engine.getPattern()))
  }, [engine, stopSongPlayback, updateSong])

  /**
   * A sound was tapped in the instrument picker (spec §4, §10.1): it plays and
   * the row swaps to it, keeping its painted steps — same rhythm, new sound.
   *
   * The audition happens whatever the swap does, because the tap is a request
   * for a sound: `swapRowInstrument` refuses an instrument the clip already
   * holds (the row's own included), so re-tapping the current sound auditions
   * it and changes nothing, which is exactly what browsing by ear needs. The
   * dialog stays open — closing is the ✕, the backdrop or Escape.
   */
  const chooseRowInstrument = useCallback(
    (instrumentId: string) => {
      if (!engine || instrumentRow === null) return
      engine.audition(instrumentId)
      const next = updateSong((s) => swapRowInstrument(engine.kit, s, instrumentRow, instrumentId))
      if (!next) return
      engine.setPattern(activeClip(next).pattern)
    },
    [engine, instrumentRow, updateSong],
  )

  /**
   * The picker's footer: drop the row and its painted steps. No confirm — it is
   * one tap to put the sound back (spec §4) — and the dialog closes, because
   * the row it was opened on has gone.
   */
  const removeRowFromClip = useCallback(() => {
    if (!engine || instrumentRow === null) return
    setInstrumentRow(null)
    const next = updateSong((s) => removeRow(s, instrumentRow))
    if (!next) return
    engine.setPattern(activeClip(next).pattern)
  }, [engine, instrumentRow, updateSong])

  const loadBoop = useCallback(
    (boop: StoredBoop, index: number) => {
      if (!engine) return
      stopSongPlayback()
      const loadedSong = songFromStored(engine.kit, boop)
      engine.setPattern(activeClip(loadedSong).pattern)
      engine.setTempo(loadedSong.bpm)
      // The engine rounds and clamps the tempo; keep its number, as the restore does.
      setSong({ ...loadedSong, bpm: engine.getTempo() })
      // The grid *is* that row now, and matches it exactly (ticket 31).
      setLoaded({ index, name: boop.name, edited: false })
      setLoadToken((token) => token + 1)
      setBoopsOpen(false)
    },
    [engine, stopSongPlayback],
  )

  if (!engine || !song) {
    return (
      <main className={styles.stage}>
        <p className={styles.loading}>Loading…</p>
      </main>
    )
  }

  // The playhead column is the last step the draw channel reached, playing or
  // not: a stop no longer hides it (spec §1), it stays put at 45%. `null` is
  // now only "nothing has sounded yet" — a page that has never played. The step
  // stays the *clip's*, so pausing a clip loop leaves the column exactly where
  // the child paused it rather than jumping to wherever the song's bar is.
  // ...unless a scrub moved it since: stopped, that is the only thing that can,
  // and it is what makes the silent preview visible (spec §4).
  const playheadStep = scrubStep ?? motion.step

  // The ring on the lane squares still means "this position is sounding", so it
  // stays playing-only. The strip and the ruler read the playhead instead, which
  // outlives a stop.
  const playingPosition = songPlaying && playheadAt !== null ? playheadAt.position : null

  const playhead: SongPlayheadView = {
    bar: playheadBar,
    position: playheadAt?.position ?? null,
    barInPosition: playheadAt?.bar ?? null,
    barCount: timeline.barCount,
    playing: songPlaying,
  }

  const gridProps: GridViewProps = {
    kit: engine.kit,
    pattern: activeClip(song).pattern,
    onToggleCell: toggleCell,
    playheadStep,
    playheadPlaying: motion.playing,
    cellStrikes: motion.cellStrikes,
    rowStrikes: motion.rowStrikes,
    loadToken,
    onScrubToStep: scrubClipToStep,
    onScrubToSongStart: () => scrubSongToBar(0),
    onOpenInstrumentPicker: setInstrumentRow,
  }

  // The picker's rows: the clip it is open on, and the hue of the row that
  // opened it (positional, like every row hue — `ROW_COLOR_VARS[i % 6]`).
  const pickerRows = activeClip(song).pattern

  return (
    // Three frame sections (ticket 33): pinned chrome, the one scrolling
    // region, the pinned dock. Each carries the centring column so the bars
    // line up with the grid — the bar is inset to the column, not full-bleed
    // (ticket 37).
    //
    // What stands in each changed with screenspace ticket 03: the song bar is
    // the home surface in the scrolling region at every width, the dock holds
    // the clip launcher alone, and the grid opens as a card over the top.
    <main className={styles.stage} data-testid="stage">
      <div className={styles.chrome}>
        <div className={styles.column}>
          {phone ? (
            // The phone's actions live in the "⋯" menu: New boop / My boops /
            // Share / How boop works / Clear grid. New boop joined them when
            // the transport went (screenspace ticket 03) — it is an action the
            // phone chrome drops, which is what the menu is for. Export is per
            // saved boop, inside the dialog.
            <PhoneBar
              getShareUrl={getShareUrl}
              onClearGrid={clearClip}
              onNewBoop={newBoop}
              onSave={() => setBoopsOpen(true)}
              onOpenMyBoops={() => setBoopsOpen(true)}
              onOpenHints={() => setHintsOpen(true)}
              loaded={loaded}
            />
          ) : (
            <TopBar
              getShareUrl={getShareUrl}
              onOpenBoops={() => setBoopsOpen(true)}
              onOpenHints={() => setHintsOpen(true)}
              loaded={loaded}
              onNewBoop={newBoop}
            />
          )}
        </div>
      </div>
      <div className={styles.scroller} data-testid="stage-scroller">
        <div className={`${styles.column} ${styles.stack}`} data-testid="stage-column">
          {/* The song bar is the home surface (screenspace ticket 03): the
              arrangement is what a child lands on, at every width, and the
              grid is the focused thing they choose to open. The song is the
              less discoverable half of the app, so it is the half that stays
              on the frame. */}
          {phone ? (
            <PhoneSongBar
              song={song}
              bpm={song.bpm}
              onTempoChange={changeTempo}
              onSelectClip={editClip}
              onTogglePlacement={togglePlacementAt}
              onAddClip={() => setPickerOpen(true)}
              onToggleSong={toggleSong}
              songPlaying={songPlaying}
              playingPosition={playingPosition}
              playhead={playhead}
              onScrubToFraction={scrubSongToFraction}
              onScrubToBar={scrubSongToBar}
            />
          ) : (
            <SongBar
              song={song}
              bpm={song.bpm}
              onTempoChange={changeTempo}
              onSelectClip={editClip}
              onTogglePlacement={togglePlacementAt}
              onMoveClip={moveClipLane}
              onAddClip={() => setPickerOpen(true)}
              onToggleSong={toggleSong}
              songPlaying={songPlaying}
              playingPosition={playingPosition}
              playhead={playhead}
              // The laptop readout left `ClipHeader` when the header moved
              // into the card (screenspace ticket 03). It reads the *song's*
              // playhead, so it belongs with the song's other numbers — and on
              // the frame, where closing the card leaves it, rather than
              // disappearing with the header that used to carry it.
              readout={playheadReadout(playhead)}
              onScrubToBar={scrubSongToBar}
              onScrubToCell={scrubSongToCell}
            />
          )}
        </div>
      </div>
      <div className={styles.dock}>
        <div className={styles.column}>
          {/* One launcher row, at every width, and nothing else. Its play is
              *clip* play — while the song plays it reads paused and pressing
              it takes over, exactly like the laptop's clip control. Song play
              is not repeated here: the song bar carries it and the song bar is
              always on screen now. */}
          <ClipLauncher
            clip={activeClip(song)}
            isPlaying={isPlaying && !songPlaying}
            onToggle={toggleClipPlay}
            onOpen={() => setClipOpen(true)}
          />
        </div>
      </div>
      {clipOpen && (
        <ClipEditorCard clipName={activeClip(song).name} onClose={() => setClipOpen(false)}>
          {/* The loop map rides inside PhoneGrid's well, so it stays glued
              under the grid rather than becoming a second transport (ADR
              0027). The clip header is the laptop row at every width — the
              phone slims it with CSS (ticket 21), not a different component. */}
          <ClipHeader
            clip={activeClip(song)}
            canDelete={song.clips.length > 1}
            canCopy={song.clips.length < MAX_CLIPS}
            onRename={renameActiveClip}
            onCopy={copyClip}
            onDelete={deleteActiveClip}
          />
          {/* Clip play is the well's footer at every width now. The phone
              reached it on the pinned transport before; the launcher that
              replaced the transport is behind this card's backdrop, so the
              button has to be in the well or there is no way to hear the clip
              being edited. Clear grid rides with it only at ≥1024 — on the
              phone that action is in the "⋯" menu. */}
          {phone ? (
            <PhoneGrid
              {...gridProps}
              wellFooter={
                <ClipControl
                  isPlaying={isPlaying && !songPlaying}
                  onToggle={toggleClipPlay}
                  onClearGrid={clearClip}
                  showClearGrid={false}
                />
              }
            />
          ) : (
            <Grid
              {...gridProps}
              tintColor={clipTint(activeClip(song).tint)}
              wellFooter={
                <ClipControl
                  isPlaying={isPlaying && !songPlaying}
                  onToggle={toggleClipPlay}
                  onClearGrid={clearClip}
                />
              }
            />
          )}
        </ClipEditorCard>
      )}
      {boopsOpen && (
        <BoopsPanel
          onClose={() => setBoopsOpen(false)}
          onLoad={loadBoop}
          getWorkingBoop={getWorkingBoop}
          onExport={exportBoop}
          loaded={loaded}
          onLoadedChange={setLoaded}
        />
      )}
      {pickerOpen && <NewClipPicker onPick={pickClip} onClose={() => setPickerOpen(false)} />}
      {/* The instrument picker opens over the clip editor card, on a row of
          the clip that card is editing (ticket 05). "Remove this row" is
          offered only while there is a row to spare: the grid's floor is one
          row (ADR 0041), and this toy disables nothing it can simply not
          show. */}
      {instrumentRow !== null && (
        <InstrumentPicker
          kit={engine.kit}
          title="Change this sound"
          inClip={pickerRows.map((row) => row.instrumentId)}
          colorVar={ROW_COLOR_VARS[instrumentRow % ROW_COLOR_VARS.length]!}
          onChoose={chooseRowInstrument}
          onClose={() => setInstrumentRow(null)}
          onRemoveRow={pickerRows.length > 1 ? removeRowFromClip : undefined}
        />
      )}
      <HintSheet open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </main>
  )
}
