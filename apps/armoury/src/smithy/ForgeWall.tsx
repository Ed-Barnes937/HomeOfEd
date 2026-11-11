import type { CSSProperties } from 'react'

import { seededRandom } from '../engine/schema.ts'
import styles from './ForgeWall.module.scss'
import { COALS, floorSvg, svgUrl, wallSvg } from './forgeArt.ts'
import { grain } from './grain.ts'

const WALL_IMAGE = svgUrl(wallSvg())
const FLOOR_IMAGE = svgUrl(floorSvg())
const tiles = grain()
const GRAIN = tiles && {
  '--grain': `url(${tiles.fine.toDataURL()})`,
  '--mottle': `url(${tiles.mottle.toDataURL()})`,
}

const rand = seededRandom(5150)
const EMBERS = Array.from({ length: 9 }, () => ({
  left: COALS.x - 110 + rand() * 220,
  drift: (rand() - 0.5) * 70,
  rise: 120 + rand() * 120,
  seconds: 3.2 + rand() * 3,
  delay: -rand() * 6,
  size: 2 + rand() * 2.5,
}))

/** The smithy's back wall with the forge's live coals and embers, front-on. */
export function ForgeWall() {
  return (
    <div className={styles.wall} aria-hidden="true">
      <div className={styles.art} style={{ backgroundImage: WALL_IMAGE, ...GRAIN }}>
        <span className={styles.texture} />
        <span className={styles.forgeLight} style={{ left: COALS.x, top: COALS.y }} />
        <span className={styles.coalGlow} style={{ left: COALS.x, top: COALS.y }} />
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={styles.ember}
            style={
              {
                left: e.left,
                top: COALS.y - 6,
                width: e.size,
                height: e.size,
                '--drift': `${e.drift}px`,
                '--rise': `${-e.rise}px`,
                animationDuration: `${e.seconds}s`,
                animationDelay: `${e.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className={styles.shade} />
    </div>
  )
}

/** The smithy's floor from above, around the anvil's stump. */
export function ForgeFloor() {
  return (
    <div className={styles.floor} aria-hidden="true">
      <div className={styles.floorArt} style={{ backgroundImage: FLOOR_IMAGE, ...GRAIN }}>
        <span className={styles.texture} />
      </div>
      <div className={styles.floorShade} />
    </div>
  )
}
