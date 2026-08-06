import { useRef, useState } from 'react'

import { useSimLoop } from '../features/sim/useSimLoop.ts'
import { SAND, v1Elements } from '../sim/index.ts'
import styles from './HomePage.module.scss'

/**
 * Minimal element picker for this ticket — the roster registered so far
 * (Dirt, Sand). The real, grouped, thirty-element rail is ticket 07; colours
 * are read straight off `v1Elements` so this list and the grid can never
 * drift apart (spec §9).
 */
const ELEMENTS = v1Elements.map((def) => ({ id: def.id, name: def.name, colour: def.colours[0] }))

export function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [selectedElement, setSelectedElement] = useState<number>(SAND)

  useSimLoop({ canvasRef, running, selectedElement })

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.title}>SILT</span>
        <button
          type="button"
          className={styles.playButton}
          data-testid="play-toggle"
          onClick={() => setRunning((current) => !current)}
        >
          {running ? 'pause' : 'play'}
        </button>
      </header>
      <div className={styles.body}>
        <nav className={styles.rail} data-testid="palette" aria-label="element palette">
          {ELEMENTS.map((element) => (
            <button
              key={element.id}
              type="button"
              className={styles.swatchRow}
              data-testid={`element-${element.name}`}
              aria-pressed={selectedElement === element.id}
              onClick={() => setSelectedElement(element.id)}
            >
              <span
                className={styles.swatch}
                style={{ background: element.colour }}
                aria-hidden="true"
              />
              {element.name}
            </button>
          ))}
        </nav>
        <canvas ref={canvasRef} className={styles.canvas} data-testid="silt-canvas" />
      </div>
    </div>
  )
}
