import { baseConfig } from '@hoe/config/eslint'

export default [
  ...baseConfig,
  {
    // Determinism is a spec rule (sand-sim spec §5.4), and a reviewer cannot
    // spot a stray Math.random() in a hook. The sim's seeded Rng is the only
    // source of randomness under src/sim — element code reaches it through
    // api.rand() / api.randInt().
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'sim code must draw from the seeded Rng, never Math.random()',
        },
      ],
    },
  },
]
