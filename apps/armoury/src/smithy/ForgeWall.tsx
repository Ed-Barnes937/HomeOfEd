import { useEffect, type CSSProperties } from 'react'

import { seededRandom } from '../engine/schema.ts'
import { smithyCardArt } from '../share/smithyCard.ts'
import styles from './ForgeWall.module.scss'
import { COALS, floorSvg, SLATE, svgUrl, wallSvg } from './forgeArt.ts'
import { grain } from './grain.ts'

let images: { wall: string; floor: string } | null = null

/** The wall and floor art, built on the smithy's first visit rather than on every page's load. */
export function forgeImages() {
  images ??= { wall: svgUrl(wallSvg(grain())), floor: svgUrl(floorSvg(grain())) }
  return images
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
  useEffect(() => void smithyCardArt(), [])
  return (
    <div className={styles.wall} aria-hidden="true">
      <div className={styles.art} style={{ backgroundImage: forgeImages().wall }}>
        <span
          className={styles.chalk}
          style={{
            left: SLATE.x + 16,
            top: SLATE.y + 12,
            transform: `rotate(${SLATE.tilt}deg)`,
            transformOrigin: `39px 80px`,
          }}
        >
          Orders
        </span>
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
      <div className={styles.floorArt} style={{ backgroundImage: forgeImages().floor }} />
      <div className={styles.floorShade} />
    </div>
  )
}
