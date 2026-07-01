import eslint from '@eslint/js'
import configPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/**
 * Shared ESLint flat config. Consumers re-export it from their own
 * eslint.config.js and may append package-specific entries:
 *
 *   import { baseConfig } from '@hoe/config/eslint'
 *   export default [...baseConfig, ...overrides]
 *
 * Type-aware rules use the typescript-eslint project service, which picks up
 * the consuming package's tsconfig.json automatically.
 */
export const baseConfig = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  configPrettier,
)

export default baseConfig
