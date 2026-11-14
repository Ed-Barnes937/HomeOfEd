import { useId } from 'react'

import { BASE_LINE, SLOT_MM } from '../potion/framing.ts'
import type { BottleOnTable } from './tableArt.ts'

// Drawn in millimetres over the box stage's slot, the foot at the origin.
const VIEW = `${-SLOT_MM / 2} ${-BASE_LINE * SLOT_MM} ${SLOT_MM} ${SLOT_MM}`

/** The bottle's shadow on the table, cast right and back from the candle, under the stage. */
export function BottleShadow({
  footing,
  className,
}: {
  footing: BottleOnTable
  className?: string
}) {
  const id = `p${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const foot = footing.footMm
  return (
    <svg className={className} viewBox={VIEW} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id={`${id}far`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`${id}near`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <linearGradient id={`${id}fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
        </linearGradient>
        <mask id={`${id}m`} maskContentUnits="userSpaceOnUse">
          <rect x={-foot} y={-40} width={SLOT_MM} height={60} fill={`url(#${id}fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path d={footing.shadow} fill="#05020a" opacity="0.8" filter={`url(#${id}far)`} />
        <path d={footing.shadow} fill="#05020a" opacity="0.5" filter={`url(#${id}near)`} />
      </g>
      <ellipse
        cx={foot * 0.18}
        cy={0.6}
        rx={foot * 1.25}
        ry={3.2}
        fill="#000"
        opacity="0.85"
        filter={`url(#${id}near)`}
      />
    </svg>
  )
}

/** The string round the neck, over the stage, its loose end hanging toward the card on the left. */
export function NeckTie({ footing, className }: { footing: BottleOnTable; className?: string }) {
  const { heightMm, halfWidthMm } = footing.tie
  const y = -heightMm
  const w = halfWidthMm + 0.5
  const loops = [
    `M${-w} ${y - 1.4} Q0 ${y + 1.6} ${w} ${y - 1.4}`,
    `M${-w} ${y + 1.2} Q0 ${y + 4.2} ${w} ${y + 1.2}`,
  ]
  return (
    <svg className={className} viewBox={VIEW} preserveAspectRatio="none" aria-hidden="true">
      {loops.map((d) => (
        <g key={d}>
          <path d={d} stroke="rgba(30, 16, 12, 0.8)" strokeWidth="1.5" fill="none" />
          <path d={d} stroke="var(--twine)" strokeWidth="1" fill="none" />
          <path
            d={d}
            stroke="rgba(70, 46, 24, 0.7)"
            strokeWidth="0.9"
            strokeDasharray="0.4 1.2"
            fill="none"
          />
        </g>
      ))}
      <circle
        cx={-w + 0.6}
        cy={y + 0.4}
        r="1.4"
        fill="var(--twine)"
        stroke="rgba(30, 16, 12, 0.7)"
        strokeWidth="0.4"
      />
    </svg>
  )
}
