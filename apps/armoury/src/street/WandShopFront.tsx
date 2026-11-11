import styles from './StreetPage.module.scss'

const BOX_ROWS = [
  [52, 82, 108, 136, 164],
  [56, 90, 120, 150],
  [50, 76, 104, 134, 160],
]

/** The wand shop seen from the street: timber and plaster, a candle-lit bay window, a blue door. */
export function WandShopFront() {
  return (
    <svg className={styles.art} viewBox="0 0 360 400" aria-hidden="true">
      <defs>
        <linearGradient id="wand-plaster" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2d22" />
          <stop offset="1" stopColor="#2a2018" />
        </linearGradient>
        <radialGradient id="wand-window" cx="0.5" cy="0.62" r="0.75">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="0.45" stopColor="#f2b056" />
          <stop offset="1" stopColor="#8a4a1c" />
        </radialGradient>
        <radialGradient id="wand-upper" cx="0.5" cy="0.6" r="0.7">
          <stop offset="0" stopColor="#f6c879" />
          <stop offset="1" stopColor="#7a4319" />
        </radialGradient>
        <linearGradient id="wand-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c3a58" />
          <stop offset="1" stopColor="#1a2238" />
        </linearGradient>
        <linearGradient id="wand-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d2a1b" />
          <stop offset="1" stopColor="#24180f" />
        </linearGradient>
      </defs>

      <path d="M18 92 L180 14 L342 92 Z" fill="#1b1714" />
      <path d="M18 92 L180 14 L342 92" fill="none" stroke="#3a2e25" strokeWidth="5" />
      <rect x="244" y="22" width="26" height="54" fill="#2b211a" />
      <rect x="240" y="18" width="34" height="8" fill="#3a2d22" />

      <rect x="28" y="90" width="304" height="310" fill="url(#wand-plaster)" />
      <g stroke="#1a120c" strokeWidth="7">
        <path d="M28 94 H332 M28 168 H332 M32 90 V170 M180 90 V168 M328 90 V170" />
        <path d="M32 94 L106 168 M328 94 L254 168" strokeWidth="5" />
      </g>

      <g className={styles.flicker}>
        <rect x="140" y="106" width="80" height="50" rx="3" fill="url(#wand-upper)" />
      </g>
      <path d="M140 131 H220 M180 106 V156" stroke="#1a120c" strokeWidth="4" />
      <rect
        x="136"
        y="102"
        width="88"
        height="58"
        rx="4"
        fill="none"
        stroke="#1a120c"
        strokeWidth="6"
      />

      <rect x="34" y="176" width="292" height="36" rx="3" fill="url(#wand-board)" />
      <rect
        x="38"
        y="180"
        width="284"
        height="28"
        rx="2"
        fill="none"
        stroke="#c99a52"
        strokeOpacity="0.55"
      />
      <g transform="translate(66 194) rotate(-12)">
        <rect x="-22" y="-2.2" width="44" height="4.4" rx="2.2" fill="#d9b06a" />
        <rect x="-22" y="-3" width="15" height="6" rx="3" fill="#8a5a2b" />
        <circle cx="24" cy="0" r="2.6" fill="#ffe7a8" />
      </g>
      <text x="196" y="202" textAnchor="middle" className={styles.signText} fill="#e8c27c">
        Wand shop
      </text>

      <rect x="44" y="226" width="168" height="134" rx="4" fill="#120c08" />
      <g className={styles.flicker}>
        <rect x="50" y="232" width="156" height="122" fill="url(#wand-window)" />
      </g>
      {BOX_ROWS.map((row, r) => (
        <g key={r}>
          <rect x="50" y={262 + r * 32} width="156" height="3" fill="#3b2516" />
          {row.map((x, i) => (
            <rect
              key={x}
              x={x}
              y={262 + r * 32 - (i % 2 ? 20 : 16)}
              width={i % 2 ? 22 : 26}
              height={i % 2 ? 20 : 16}
              fill={['#2b1f16', '#3b2d22', '#24304a', '#33261b'][(i + r) % 4]}
            />
          ))}
        </g>
      ))}
      <g transform="translate(118 342)">
        <rect x="-4" y="-14" width="8" height="14" fill="#efe1c2" />
        <path
          className={styles.flame}
          d="M0 -26 C4 -20 4 -16 0 -14 C-4 -16 -4 -20 0 -26 Z"
          fill="#fff1c4"
        />
      </g>
      <g stroke="#1a120c" strokeWidth="5" fill="none">
        <rect x="47" y="229" width="162" height="128" />
        <path d="M101 229 V357 M155 229 V357 M47 293 H209" strokeWidth="3.5" />
      </g>
      <rect x="38" y="356" width="180" height="10" rx="2" fill="#4a3322" />

      <path d="M234 400 V250 A38 38 0 0 1 310 250 V400 Z" fill="#120c08" />
      <path d="M240 400 V252 A32 32 0 0 1 304 252 V400 Z" fill="url(#wand-door)" />
      <g className={styles.flicker}>
        <rect x="240" y="248" width="64" height="152" fill="url(#wand-window)" />
      </g>
      <path d="M240 248 H290 L294 252 V398 L290 400 H240 Z" fill="url(#wand-door)" />
      <g className={styles.flicker}>
        <path d="M246 248 A26 26 0 0 1 298 248 Z" fill="#f2b056" opacity="0.9" />
      </g>
      <path d="M246 248 H298 M272 222 V248" stroke="#120c08" strokeWidth="3" />
      <g fill="none" stroke="#3c4f78" strokeWidth="2.5">
        <rect x="248" y="262" width="36" height="54" rx="2" />
        <rect x="248" y="328" width="36" height="58" rx="2" />
      </g>
      <circle cx="286" cy="330" r="3.5" fill="#c99a52" />
      <rect x="226" y="392" width="92" height="8" fill="#4a3322" />
    </svg>
  )
}
