import { useEffect, useId, type CSSProperties } from 'react'

import { apothecaryCardArt } from '../share/apothecaryCard.ts'
import styles from './RoomWall.module.scss'
import { BOARD_H, BOARD_W, CANDLE, FLAME, FLAME_FOOT, roomImage } from './tableArt.ts'

const at = (x: number, y: number) =>
  ({ '--x': `${(x / BOARD_W) * 100}%`, '--y': `${(y / BOARD_H) * 100}%` }) as CSSProperties

function Flame() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { halo, root, core } = FLAME
  return (
    <svg className={styles.flame} style={at(FLAME_FOOT.x, FLAME_FOOT.y)} viewBox="-30 -64 60 70">
      <defs>
        <radialGradient id={`${id}f`} cx="0.5" cy="0.72" r="0.62">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.32" stopColor="#ffe089" />
          <stop offset="0.75" stopColor="#ff9a3a" />
          <stop offset="1" stopColor="#ff7420" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor="#ffd58c" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9a3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cy={halo.cy} rx={halo.rx} ry={halo.ry} fill={`url(#${id}h)`} />
      <path d={FLAME.body} fill={`url(#${id}f)`} />
      <ellipse cy={root.cy} rx={root.rx} ry={root.ry} fill="#4a72d8" opacity="0.55" />
      <ellipse cy={core.cy} rx={core.rx} ry={core.ry} fill="#fffef2" opacity="0.9" />
    </svg>
  )
}

/** The potion shop's room: the cabinet and the table drawn once, the candle's flame and light live over them. */
export function RoomWall() {
  useEffect(() => void apothecaryCardArt(), [])
  return (
    <div className={styles.room} aria-hidden="true">
      <div className={styles.art} style={{ backgroundImage: roomImage() }}>
        <span className={styles.candleLight} style={at(CANDLE.x, CANDLE.flameY)} />
        <Flame />
      </div>
      <div className={styles.shade} />
    </div>
  )
}
