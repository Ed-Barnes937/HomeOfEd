import { useId } from 'react'

import { ANVIL_H, ANVIL_TOP, ANVIL_W } from './anvilArt.ts'

const blur = (id: string, sd: number) => (
  <filter id={`${id}b${sd * 10}`} x="-20%" y="-150%" width="140%" height="400%">
    <feGaussianBlur stdDeviation={sd} />
  </filter>
)

/**
 * The sword's shadow from its outline, cast away from the forge (right) and the window (toward
 * the viewer): tight on the anvil's top, the hilt casting further, soft and far where it overhangs.
 */
export function SwordShadow({
  blade,
  hilt,
  className,
}: {
  blade: string
  hilt: string
  className?: string
}) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const all = blade + hilt
  const f = (sd: number) => `url(#${id}b${sd * 10})`
  return (
    <svg
      className={className}
      viewBox={`0 0 ${ANVIL_W} ${ANVIL_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`${id}top`}>
          <path d={ANVIL_TOP} />
        </clipPath>
        <mask
          id={`${id}off`}
          maskUnits="userSpaceOnUse"
          x="-200"
          y="-300"
          width="1400"
          height="800"
        >
          <rect x="-200" y="-300" width="1400" height="800" fill="#fff" />
          <path d={ANVIL_TOP} fill="#000" />
        </mask>
        {blur(id, 2)}
        {blur(id, 2.5)}
        {blur(id, 3)}
        {blur(id, 4)}
        {blur(id, 5)}
        {blur(id, 6)}
        {blur(id, 14)}
        {blur(id, 16)}
      </defs>
      <g mask={`url(#${id}off)`}>
        <path d={all} fill="#000" opacity="0.85" filter={f(6)} transform="translate(24 4)" />
        <path d={all} fill="#000" opacity="0.45" filter={f(14)} transform="translate(-12 22)" />
      </g>
      <g clipPath={`url(#${id}top)`}>
        <path d={all} fill="#000" opacity="0.5" filter={f(6)} />
        <path
          d={blade}
          fill="#08101c"
          opacity="0.7"
          filter={f(2.5)}
          transform="translate(10 -1.5)"
        />
        <path d={hilt} fill="#08101c" opacity="0.85" filter={f(4)} transform="translate(30 -4.5)" />
        <path d={blade} fill="#1e0f06" opacity="0.4" filter={f(3)} transform="translate(-4 5)" />
        <path d={hilt} fill="#1e0f06" opacity="0.45" filter={f(5)} transform="translate(-11 14)" />
        <path d={all} fill="#000" opacity="0.9" filter={f(2)} transform="translate(1 1)" />
      </g>
    </svg>
  )
}
