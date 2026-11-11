import { useId } from 'react'

import { ANVIL_H, ANVIL_TOP, ANVIL_W } from './anvilArt.ts'

/** The sword's shadow from its outline: tight on the anvil's top, soft and far where it overhangs. */
export function SwordShadow({ d, className }: { d: string; className?: string }) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const top = `${id}top`
  const off = `${id}off`
  return (
    <svg
      className={className}
      viewBox={`0 0 ${ANVIL_W} ${ANVIL_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={top}>
          <path d={ANVIL_TOP} />
        </clipPath>
        <mask id={off} maskUnits="userSpaceOnUse" x="-200" y="-300" width="1400" height="800">
          <rect x="-200" y="-300" width="1400" height="800" fill="#fff" />
          <path d={ANVIL_TOP} fill="#000" />
        </mask>
        <filter id={`${id}b1`} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={`${id}b4`} x="-10%" y="-80%" width="120%" height="260%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id={`${id}b14`} x="-20%" y="-150%" width="140%" height="400%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g mask={`url(#${off})`}>
        <path
          d={d}
          fill="#000"
          opacity="0.5"
          filter={`url(#${id}b14)`}
          transform="translate(44 -4)"
        />
      </g>
      <g clipPath={`url(#${top})`}>
        <path
          d={d}
          fill="#0a1220"
          opacity="0.4"
          filter={`url(#${id}b4)`}
          transform="translate(9 -1.5)"
        />
        <path
          d={d}
          fill="#1e0f06"
          opacity="0.28"
          filter={`url(#${id}b4)`}
          transform="translate(-4 6)"
        />
        <path
          d={d}
          fill="#000"
          opacity="0.7"
          filter={`url(#${id}b1)`}
          transform="translate(2.5 2)"
        />
      </g>
    </svg>
  )
}
