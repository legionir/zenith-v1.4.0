// ESLint flat config (#36).
// - packages/**/src + test: typed linting via tsconfig.eslint.json.
// - scripts/*.mjs and extension/plain JS: untyped, node or browser globals.
// - no-explicit-any is a *warning* until #38 zeroes out the ~240 remaining
//   `any`s in public APIs (documented in DEC-003). All other errors are
//   enforced (lint fails the build on them).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/out/**',
      'browser-bundles/**',
      'artifacts/**',
      'coverage/**',
      'docs/**',
      'demos/**',
      'ecommerce-demo/**',
      'dashboard/**',
      'benchmarks/**',
      'index.html',
      '**/*.d.ts',
    ],
  },

  // ── TypeScript sources (typed rules) ──
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/src/**/*.ts', 'packages/**/test/**/*.ts', 'vitest.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
        ServiceWorkerGlobalScope: 'readonly',
        IDBDatabase: 'readonly',
        indexedDB: 'readonly',
        caches: 'readonly',
        Cache: 'readonly',
        chrome: 'readonly',
      },
    },
    rules: {
      // #36 requested rules
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'warn', // error after #38

      // TS type checker already flags undefined names; no-undef is noise.
      'no-undef': 'off',
      'no-console': 'off', // logger centralization is #39

      // Unused *caught* errors are an established pattern here
      // (`catch (err) { /* best-effort */ }`); forcing `_` on ~20 existing
      // catches adds no value (DEC-003). Unused args/vars stay errors.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^[A-Z]$',
          caughtErrors: 'none',
        },
      ],
      // `Function` as an internal set/map key type is pervasive (reactivity
      // graph); tightening these signatures is #38/#40 scope (DEC-003).
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // empty catch blocks are deliberate best-effort guards in this codebase
      'no-empty': ['error', { allowEmptyCatch: true }],
      // while(true)-style parser loops are intentional and bounded internally
      'no-constant-condition': ['error', { checkLoops: false }],
      // `import('mod').Type` is required by packages without a root type
      // re-export; enforce type-imports for statements only (DEC-003).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },

  // ── Security code deliberately matches control chars (\x00 NUL-stripping
  // guards in sanitizer/bind). The rule is disabled for these two files only,
  // with the reason documented in DEC-003. ──
  {
    files: ['packages/security/src/sanitizer.ts', 'packages/runtime/src/directives/bind.ts'],
    rules: { 'no-control-regex': 'off' },
  },

  // ── Root CommonJS config files (.dependency-cruiser.cjs, …) ──
  {
    files: ['**/*.cjs'],
    languageOptions: {
      parserOptions: { project: null, sourceType: 'commonjs' },
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },

  // ── Build scripts (untyped, node) ──
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      parserOptions: { project: null },
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ── Browser extension plain JS (untyped) ──
  {
    files: ['packages/devtools-extension/**/*.js', 'packages/vscode-extension/**/*.js'],
    languageOptions: {
      parserOptions: { project: null },
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
);
