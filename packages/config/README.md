# @hoe/config

Shared base configs for every package and app: TypeScript, ESLint (flat config),
Prettier. Plumbing only — no runtime code.

## Exports

| Export | What it is |
|---|---|
| `@hoe/config/tsconfig.base.json` | Strict base `tsconfig` (ES2023, `moduleResolution: bundler`, `noEmit`) |
| `@hoe/config/eslint` | Flat-config array: `@eslint/js` recommended + `typescript-eslint` recommended-type-checked + prettier compat |
| `@hoe/config/prettier` | Prettier options (`semi: false`, `singleQuote`, `printWidth: 100`) |

## Usage

Add dev dependencies (the tool binaries are peer deps — each consumer installs
its own so pnpm puts them in that package's `.bin`):

```jsonc
// package.json
{
  "prettier": "@hoe/config/prettier",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@hoe/config": "workspace:*",
    "eslint": "^9.39.2",
    "prettier": "^3.8.0",
    "typescript": "^5.9.3"
  }
}
```

```jsonc
// tsconfig.json
{
  "extends": "@hoe/config/tsconfig.base.json",
  "include": ["src", "eslint.config.js"]
}
```

```js
// eslint.config.js
import { baseConfig } from '@hoe/config/eslint'

export default baseConfig
// or: export default [...baseConfig, ...packageSpecificEntries]
```

Type-aware lint rules use the typescript-eslint **project service**, which
resolves the consuming package's `tsconfig.json` automatically — no
`parserOptions.project` needed. Browser/DOM code adds `"lib": ["ES2023", "DOM",
"DOM.Iterable"]` in its own `tsconfig.json`.

## Cross-package types

Internal packages are consumed **as TypeScript source** (`exports` → `.ts`);
per-package `tsc --noEmit` + the Turborepo cache replace project references.
Rationale: [ADR 0004](../../docs/adr/0004-typescript-source-exports.md).

## Testing

Exercised by every consumer's `lint`/`typecheck`. Acceptance for T0.2 was a
throwaway consumer package: extending these configs passed, and a deliberate
type error + floating-promise violation both failed.
