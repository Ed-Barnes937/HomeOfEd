import { Toolbar } from '../features/controls/Toolbar.tsx'
import { useDoodle } from '../features/doodle/useDoodle.ts'
import styles from './DoodlePage.module.scss'

/** Sketchbook shell (spec §11.1): header → canvas card → toolbar footer. */
export function DoodlePage() {
  const { canvasRef, tool, setTool, nib, setNib, newPage, undo, canUndo, save } = useDoodle()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.wordmark}>
            ひらめき<span className={styles.label}>Hirameki</span>
          </h1>
          <p className={styles.subtitle}>
            Add a few lines — legs, a tail, whiskers, a smile. Then give it eyes, and the ink
            comes alive.
          </p>
        </div>
      </header>

      <div className={styles.canvasArea}>
        <div className={styles.card}>
          <canvas
            ref={canvasRef}
            data-testid="doodle-canvas"
            className={styles.canvas}
            data-tool={tool}
          />
        </div>
      </div>

      <footer className={styles.toolbar}>
        <Toolbar
          tool={tool}
          setTool={setTool}
          nib={nib}
          setNib={setNib}
          newPage={newPage}
          undo={undo}
          canUndo={canUndo}
          save={save}
        />
      </footer>
    </main>
  )
}
