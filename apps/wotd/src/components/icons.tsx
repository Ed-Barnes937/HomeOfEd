// Small inline SVG icon components — replaces lucide-react per the restyle
// rules (no external icon package). Each renders a 24x24 viewBox glyph that
// inherits the current text colour via `currentColor`.
import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...props }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', ...props }
}

export function LightbulbIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M9 18h6M10 21h4M8 14a5 5 0 1 1 8 0c-.8.9-1.5 1.7-1.5 3h-5c0-1.3-.7-2.1-1.5-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19l1.3-6-4.6-4.1 6.1-.6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ZapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function RocketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3c2.5 1.5 4 4.2 4 8 0 2-1 4-1 4l-3 1-3-1s-1-2-1-4c0-3.8 1.5-6.5 4-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 16l-2 4 3-1M15 16l2 4-3-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M11 3l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4ZM19 13l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6.6-2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M14 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12H4M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BookOpenIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 6c-1.5-1.2-3.5-1.8-6-1.8v13c2.5 0 4.5.6 6 1.8V6ZM12 6c1.5-1.2 3.5-1.8 6-1.8v13c-2.5 0-4.5.6-6 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
