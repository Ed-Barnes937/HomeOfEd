import styles from './StreetPage.module.scss'

const BRICK_ROWS = Array.from({ length: 9 }, (_, i) => i)

/** The smithy seen from the street: brick and timber, wide doors open on the forge's glow. */
export function SmithyFront() {
  return (
    <svg className={styles.art} viewBox="0 0 360 400" aria-hidden="true">
      <defs>
        <linearGradient id="smithy-wall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a2c1f" />
          <stop offset="0.5" stopColor="#5a3524" />
          <stop offset="1" stopColor="#3a231a" />
        </linearGradient>
        <radialGradient id="smithy-forge" cx="0.5" cy="0.78" r="0.85">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.28" stopColor="#ff8a2a" />
          <stop offset="0.62" stopColor="#b8400f" />
          <stop offset="1" stopColor="#3a160a" />
        </radialGradient>
        <linearGradient id="smithy-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34302d" />
          <stop offset="1" stopColor="#1e1b19" />
        </linearGradient>
        <radialGradient id="smithy-smoke">
          <stop offset="0" stopColor="#8d8780" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8d8780" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className={styles.smoke}>
        <circle cx="292" cy="10" r="16" fill="url(#smithy-smoke)" />
        <circle cx="300" cy="-14" r="22" fill="url(#smithy-smoke)" />
        <circle cx="288" cy="-40" r="26" fill="url(#smithy-smoke)" />
      </g>
      <rect x="272" y="20" width="40" height="80" fill="#3a231a" />
      <g stroke="#24150f" strokeWidth="2">
        <path d="M272 36 H312 M272 52 H312 M272 68 H312 M272 84 H312" />
      </g>
      <rect x="266" y="14" width="52" height="10" fill="#2a1a12" />

      <path d="M14 112 L60 52 H300 L346 112 Z" fill="#1b1714" />
      <path d="M14 112 L60 52 H300 L346 112" fill="none" stroke="#3a2e25" strokeWidth="5" />

      <rect x="24" y="110" width="312" height="290" fill="url(#smithy-wall)" />
      <g stroke="#2a170f" strokeWidth="1.6" opacity="0.8">
        {BRICK_ROWS.map((r) => (
          <g key={r}>
            <path d={`M24 ${122 + r * 30} H336`} />
            {Array.from({ length: 9 }, (_, i) => {
              const x = 24 + i * 38 + (r % 2 ? 19 : 0)
              return <path key={i} d={`M${x} ${122 + r * 30} v${r < 8 ? 30 : 0}`} />
            })}
          </g>
        ))}
      </g>
      <rect x="24" y="110" width="312" height="8" fill="#2a1a12" />

      <rect x="34" y="128" width="292" height="36" rx="2" fill="url(#smithy-board)" />
      <rect x="38" y="132" width="284" height="28" rx="1" fill="none" stroke="#6e655c" />
      <g fill="#6e655c">
        <circle cx="44" cy="138" r="2" />
        <circle cx="316" cy="138" r="2" />
        <circle cx="44" cy="154" r="2" />
        <circle cx="316" cy="154" r="2" />
      </g>
      <path
        d="M60 140 H96 V143 C90 144 86 146 84 149 V152 H90 V156 H66 V152 H72 V149 C70 146 66 145 62 145 C56 145 52 143 50 140 Z"
        fill="#c9ccd0"
      />
      <text x="196" y="155" textAnchor="middle" className={styles.signText} fill="#e7b179">
        Smithy
      </text>

      <path
        d="M168 176 a12 12 0 1 1 24 0 v10 h-5 v-10 a7 7 0 1 0 -14 0 v10 h-5 Z"
        fill="#9a9a9e"
        transform="rotate(180 180 181)"
      />

      <rect x="96" y="194" width="168" height="206" fill="#120a06" />
      <g className={styles.glow}>
        <rect x="102" y="200" width="156" height="200" fill="url(#smithy-forge)" />
      </g>
      <g fill="#1a0e08">
        <path d="M142 338 H222 V346 C212 348 206 352 204 358 V372 H214 V380 H152 V372 H162 V358 C160 352 154 350 146 349 C136 349 128 346 124 338 Z" />
        <rect x="166" y="380" width="34" height="20" />
      </g>
      <rect x="96" y="194" width="168" height="8" fill="#2a170f" />

      <path d="M96 202 L48 214 V400 H96 Z" fill="#4a3324" />
      <path d="M264 202 L312 214 V400 H264 Z" fill="#4a3324" />
      <g stroke="#2e1f15" strokeWidth="3">
        <path d="M72 208 V400 M288 208 V400" />
        <path
          d="M50 260 L96 252 M50 340 L96 336 M310 260 L264 252 M310 340 L264 336"
          strokeWidth="5"
        />
      </g>
      <g opacity="0.55">
        <path d="M96 202 L48 214 V400 H96 Z" fill="#ff8a2a" opacity="0.18" />
        <path d="M264 202 L312 214 V400 H264 Z" fill="#ff8a2a" opacity="0.18" />
      </g>
    </svg>
  )
}
