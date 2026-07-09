import { useCallback, useRef, useState } from 'react'

import { ActionButtons } from '../features/controls/ActionButtons.tsx'
import { ClearingRakeToggle } from '../features/controls/ClearingRakeToggle.tsx'
import { GearTrain } from '../features/controls/GearTrain.tsx'
import { PresetsMenu } from '../features/controls/PresetsMenu.tsx'
import { PreviewToggle } from '../features/controls/PreviewToggle.tsx'
import { RingPicker } from '../features/controls/RingPicker.tsx'
import { TunePopover } from '../features/controls/TunePopover.tsx'
import { MAX_GEARS } from '../features/garden/engine/gears.ts'
import { clampOffset, clampSpeed, DEFAULT_CONFIG, type GardenConfig } from '../features/garden/engine/state.ts'
import {
  deletePreset,
  loadPresets,
  renamePreset,
  savePreset,
  type Preset,
} from '../features/garden/settings.ts'
import { useRakeLoop } from '../features/garden/useRakeLoop.ts'
import styles from './KaresansuiPage.module.scss'

export function KaresansuiPage() {
  const sandRef = useRef<HTMLCanvasElement>(null)
  const mechRef = useRef<HTMLCanvasElement>(null)

  const [config, setConfig] = useState<GardenConfig>(DEFAULT_CONFIG)
  const [running, setRunning] = useState(false)
  // A draw has begun but isn't currently running — distinguishes "paused" from
  // "idle" for the Play button label (the hook holds the real elapsed time;
  // this just mirrors it for the label).
  const [carveStarted, setCarveStarted] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(window.localStorage))

  const handleCarveComplete = useCallback(() => {
    setRunning(false)
    setCarveStarted(false)
  }, [])

  // Not destructured: `clear`/`exportPNG` are method-shaped on the hook's return
  // type, so extracting bare references trips unbound-method lint — call them
  // through `rakeLoop.` instead.
  const rakeLoop = useRakeLoop({
    sandRef,
    mechRef,
    config,
    running,
    onCarveComplete: handleCarveComplete,
  })

  /** Abort any run, reset play/pause/clearing, apply `patch` — the reference `invalidate`. */
  function invalidate(patch: Partial<GardenConfig>): void {
    setRunning(false)
    setCarveStarted(false)
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  function setRing(ring: number): void {
    invalidate({ ring })
  }

  function addWheel(teeth: number): void {
    if (config.wheels.length >= MAX_GEARS) return
    invalidate({ wheels: [...config.wheels, teeth] })
  }

  function removeWheel(index: number): void {
    if (config.wheels.length <= 1) return
    invalidate({ wheels: config.wheels.filter((_, i) => i !== index) })
  }

  function setOffset(raw: number): void {
    invalidate({ offset: clampOffset(raw / 100) })
  }

  function setShowPreview(showPreview: boolean): void {
    invalidate({ showPreview })
  }

  // The clearing rake is read at the next phase boundary — no invalidate, so it
  // can be toggled without resetting the bed.
  function setClearingRake(clearingRake: boolean): void {
    setConfig((prev) => ({ ...prev, clearingRake }))
  }

  // Speed only changes the next run's draw duration — no invalidate.
  function setSpeed(speed: number): void {
    setConfig((prev) => ({ ...prev, speed: clampSpeed(speed) }))
  }

  function handlePlay(): void {
    if (clearing) return
    if (!carveStarted) {
      setCarveStarted(true)
      setRunning(true)
      return
    }
    setRunning((r) => !r)
  }

  function handleClear(): void {
    if (running || clearing) return
    setClearing(true)
    rakeLoop.clear()
    // Mirrors the hook's internal sweep duration — there's no completion
    // callback from `clear()`, so the label/Play-lock times out alongside it.
    setTimeout(() => setClearing(false), 1800)
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
      speed: preset.speed,
    }))
  }

  function handleRenamePreset(index: number, name: string): void {
    setPresets((prev) => renamePreset(index, name, prev, window.localStorage))
  }

  function handleDeletePreset(index: number): void {
    setPresets((prev) => deletePreset(index, prev, window.localStorage))
  }

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
                aria-label={`Sand garden grooved by a ${patternLabel}`}
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
          <div className={styles.tuneGroup}>
            <TunePopover
              offset={config.offset}
              speed={config.speed}
              onOffset={setOffset}
              onSpeed={setSpeed}
            />
            <ClearingRakeToggle
              checked={config.clearingRake}
              onChange={() => setClearingRake(!config.clearingRake)}
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
            clearing={clearing}
            onPlay={handlePlay}
            onClear={handleClear}
            onSave={handleSave}
            onDownload={() => rakeLoop.exportPNG()}
          />
          <PresetsMenu
            presets={presets}
            onLoad={handleLoadPreset}
            onRename={handleRenamePreset}
            onDelete={handleDeletePreset}
          />
        </div>
      </footer>
    </main>
  )
}
