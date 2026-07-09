import { Toolbar } from '../features/controls/Toolbar.tsx'
import { useDoodle } from '../features/doodle/useDoodle.ts'
import { IntroSplash } from '../features/intro/IntroSplash.tsx'
import styles from './DoodlePage.module.scss'

/** The one-line "how to play" hint. Shown as the header subtitle on wider
 * viewports; surfaced through the toolbar's `?` tooltip when the subtitle is
 * hidden (narrow viewports). Single source so the two never drift. */
export const HINT_TEXT =
  'Add a few lines - legs, a tail, whiskers, a smile. Then give it eyes, and the ink comes alive.'

/** Sketchbook shell (spec §11.1): header → canvas card → toolbar footer. */
export function DoodlePage() {
  const { canvasRef, tool, setTool, nib, setNib, newPage, undo, canUndo, save } = useDoodle()

  return (
    <main className={styles.page}>
      <IntroSplash />
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.wordmark}>espy</h1>
          <p className={styles.subtitle} data-testid="hint-subtitle">
            {HINT_TEXT}
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
          hint={HINT_TEXT}
        />
      </footer>
    </main>
  )
}
