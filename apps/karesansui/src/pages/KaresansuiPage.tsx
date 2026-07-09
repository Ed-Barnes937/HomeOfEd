import { useCallback, useRef, useState } from 'react'

import { ActionButtons } from '../features/controls/ActionButtons.tsx'
import { GearTrain } from '../features/controls/GearTrain.tsx'
import { PreviewToggle } from '../features/controls/PreviewToggle.tsx'
import { RakePicker } from '../features/controls/RakePicker.tsx'
import { RingPicker } from '../features/controls/RingPicker.tsx'
import { SavedTray } from '../features/controls/SavedTray.tsx'
import { TunePopover } from '../features/controls/TunePopover.tsx'
import { fullTurns, MAX_GEARS, prettyTurns } from '../features/garden/engine/gears.ts'
import {
  clampOffset,
  clampSpeed,
  DEFAULT_CONFIG,
  type GardenConfig,
  type RakeId,
} from '../features/garden/engine/state.ts'
import { deletePreset, loadPresets, savePreset, type Preset } from '../features/garden/settings.ts'
import { useRakeLoop } from '../features/garden/useRakeLoop.ts'
import styles from './KaresansuiPage.module.scss'

export function KaresansuiPage() {
  const sandRef = useRef<HTMLCanvasElement>(null)
  const mechRef = useRef<HTMLCanvasElement>(null)

  const [config, setConfig] = useState<GardenConfig>(DEFAULT_CONFIG)
  const [running, setRunning] = useState(false)
  // A carve has begun but isn't currently running — distinguishes "paused" from
  // "idle" for the Run button label (the hook itself holds the real elapsed
  // time; this just mirrors it for the label).
  const [carveStarted, setCarveStarted] = useState(false)
  const [smoothing, setSmoothing] = useState(false)
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(window.localStorage))

  const handleCarveComplete = useCallback(() => {
    setRunning(false)
    setCarveStarted(false)
  }, [])

  // Not destructured: `smooth`/`exportPNG` are method-shaped on the hook's
  // return type, so extracting bare references trips unbound-method lint —
  // call them through `rakeLoop.` instead.
  const rakeLoop = useRakeLoop({
    sandRef,
    mechRef,
    config,
    running,
    onCarveComplete: handleCarveComplete,
  })

  /** Abort any run, reset run/pause/smoothing, apply `patch` — the reference `invalidate`. */
  function invalidate(patch: Partial<GardenConfig>): void {
    setRunning(false)
    setCarveStarted(false)
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  function setRing(ring: number): void {
    invalidate({ ring, turns: prettyTurns(ring, config.wheels) })
  }

  function addWheel(teeth: number): void {
    if (config.wheels.length >= MAX_GEARS) return
    const wheels = [...config.wheels, teeth]
    invalidate({ wheels, turns: prettyTurns(config.ring, wheels) })
  }

  function removeWheel(index: number): void {
    if (config.wheels.length <= 1) return
    const wheels = config.wheels.filter((_, i) => i !== index)
    invalidate({ wheels, turns: prettyTurns(config.ring, wheels) })
  }

  function setOffset(raw: number): void {
    invalidate({ offset: clampOffset(raw / 100) })
  }

  function setRake(rake: RakeId): void {
    invalidate({ rake })
  }

  function setTurns(turns: number): void {
    invalidate({ turns })
  }

  function setShowPreview(showPreview: boolean): void {
    invalidate({ showPreview })
  }

  // Speed only changes the next run's carve duration — no invalidate.
  function setSpeed(speed: number): void {
    setConfig((prev) => ({ ...prev, speed: clampSpeed(speed) }))
  }

  function handleRun(): void {
    if (smoothing) return
    if (!carveStarted) {
      setCarveStarted(true)
      setRunning(true)
      return
    }
    setRunning((r) => !r)
  }

  function handleSmooth(): void {
    if (running || smoothing) return
    setSmoothing(true)
    rakeLoop.smooth()
    // Mirrors the hook's internal sweep duration — there's no completion
    // callback from `smooth()`, so the label/Run-lock times out alongside it.
    setTimeout(() => setSmoothing(false), 1550)
  }

  function handleSave(): void {
    setPresets((prev) => savePreset(config, prev, window.localStorage))
  }

  function handleLoadPreset(preset: Preset): void {
    setRunning(false)
    setCarveStarted(false)
    setConfig((prev) => ({
      ...prev,
      ring: preset.ring,
      wheels: preset.wheels,
      offset: preset.offset,
      rake: preset.rake,
      speed: preset.speed,
      turns: Math.max(1, Math.min(preset.turns, fullTurns(preset.ring, preset.wheels))),
    }))
  }

  function handleDeletePreset(index: number): void {
    setPresets((prev) => deletePreset(index, prev, window.localStorage))
  }

  const full = fullTurns(config.ring, config.wheels)
  const turns = Math.min(config.turns, full)
  const patternLabel = `${config.ring}-tooth ring · ${config.wheels.join('·')} cog train`
  const paused = !running && carveStarted

  return (
    <main className={styles.room} data-testid="karesansui-page">
      <header className={styles.wordmark}>
        <span className={styles.mark}>枯山水</span>
        <span className={styles.sep} aria-hidden="true" />
        <span className={styles.word}>Karesansui</span>
        <span className={styles.tagline}>Zen Gear Garden</span>
      </header>

      <section className={styles.stage}>
        <figure className={styles.mechCompanion}>
          <div className={styles.mechBowl}>
            <canvas
              ref={mechRef}
              data-testid="mech-canvas"
              className={styles.mechCanvas}
              aria-hidden="true"
            />
          </div>
          <figcaption className={styles.caption}>The mechanism</figcaption>
        </figure>

        <figure className={styles.sandHero}>
          <div className={styles.sandBowl}>
            <div className={styles.sandInner}>
              <canvas
                ref={sandRef}
                data-testid="sand-canvas"
                className={styles.sandCanvas}
                role="img"
                aria-label={`Sand garden raked from a ${patternLabel}`}
              />
            </div>
          </div>
        </figure>
      </section>

      <footer className={styles.console} data-testid="console">
        <div className={styles.controls}>
          <RingPicker ring={config.ring} onChange={setRing} />
          <span className={styles.divider} aria-hidden="true" />
          <GearTrain wheels={config.wheels} onAdd={addWheel} onRemove={removeWheel} />
          <span className={styles.divider} aria-hidden="true" />
          <RakePicker rake={config.rake} onChange={setRake} />
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.tuneGroup}>
            <TunePopover
              offset={config.offset}
              speed={config.speed}
              turns={turns}
              fullTurns={full}
              onOffset={setOffset}
              onSpeed={setSpeed}
              onRotations={setTurns}
            />
            <PreviewToggle
              checked={config.showPreview}
              onChange={() => setShowPreview(!config.showPreview)}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <ActionButtons
            running={running}
            paused={paused}
            smoothing={smoothing}
            onRun={handleRun}
            onSmooth={handleSmooth}
            onSave={handleSave}
            onExport={() => rakeLoop.exportPNG()}
          />
        </div>

        <SavedTray presets={presets} onLoad={handleLoadPreset} onDelete={handleDeletePreset} />
      </footer>
    </main>
  )
}
