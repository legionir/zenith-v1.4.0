// ESLint flat config (#36).
// - packages/**/src + test: typed linting via tsconfig.eslint.json.
// - scripts/*.mjs and extension/plain JS: untyped, node or browser globals.
// - no-explicit-any is a *warning* until #38 zeroes out the ~240 remaining
//   `any`s in public APIs (documented in DEC-003). All other errors are
//   enforced (lint fails the build on them).
// - no-console: 'error' for package src since #143 (@zenith/logger); the
//   the legacy files listed in scripts/no-console-ratchet.mjs stay exempt
//   until their migration in #39 (the ratchet only shrinks — enforced by
//   scripts/test/no-console-ratchet.test.mjs). DEC-003's «off until #39»
//   row is superseded by this two-step: rule ON now, code migrated in #39.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { NO_CONSOLE_RATCHET } from './scripts/no-console-ratchet.mjs';
import {
  loadAllowlist,
  isOptionsParamText,
  ALLOWLIST_PATH,
} from './scripts/positional-config-audit.mjs';

// ── #55 — قاعدهٔ `options-object` ──
//
// API-CONVENTIONS §۱.۱/§۴: تابع عمومی با بیش از دو پارامتر باید
// `fn(main, options?)` باشد. این قاعده در زمان lint همان چیزی را می‌گیرد که
// `npm run check:positional-config` در CI می‌گیرد، تا «پیکربندی positional
// جدید» همان‌جا که نوشته می‌شود رد شود. امضاهای موجودِ بازبینی‌شده در
// scripts/positional-config.allowlist.json (دسته‌محور و با دلیل) معاف‌اند.
const POSITIONAL_ALLOW = new Set(loadAllowlist(process.cwd()).map((e) => `${e.pkg}:${e.name}`));

const optionsObjectRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'public functions take `(main, options?)` — positional config is frozen in ' +
        `${ALLOWLIST_PATH} and may not grow (#55)`,
    },
    schema: [],
    messages: {
      optionsObject:
        '`{{name}}` پارامتر پیکربندی positional دارد؛ امضای `fn(main, options?)` بسازید ' +
        '(overload قدیمی با @deprecated + deprecate()) یا دلیل را در ' +
        `${ALLOWLIST_PATH} ثبت کنید (#55).`,
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const m = /packages[\\/]([^\\/]+)[\\/]src[\\/]/.exec(filename.split('\\').join('/'));
    if (!m) return {};
    const pkg = m[1];

    // همان predicate گیت #55 (تک منبع حقیقت — واگرایی غیرممکن).
    const isOptionsParam = (param) => isOptionsParamText(context.sourceCode.getText(param));
    // @deprecated روی JSDocِ خودِ export است (والد declaration) و باید همان‌جا دیده شود.
    const isDeprecated = (node) => {
      const target =
        node.parent && node.parent.type === 'ExportNamedDeclaration' ? node.parent : node;
      return context.sourceCode.getCommentsBefore(target).some((c) => /@deprecated/.test(c.value));
    };

    const check = (node, name) => {
      const params = node.params.filter((p) => !(p.type === 'Identifier' && p.name === 'this'));
      if (params.length <= 2) return;
      if (params.some(isOptionsParam)) return;
      if (POSITIONAL_ALLOW.has(`${pkg}:${name}`)) return;
      if (isDeprecated(node)) return;
      context.report({ node, messageId: 'optionsObject', data: { name } });
    };

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === 'FunctionDeclaration' && decl.id) check(decl, decl.id.name);
        if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations) {
            if (d.id.type !== 'Identifier') continue;
            if (
              d.init &&
              (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression')
            ) {
              check(d.init, d.id.name);
            }
          }
        }
      },
    };
  },
};

const zenithPlugin = { rules: { 'options-object': optionsObjectRule } };

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // #118/#134: پوشهٔ موقت buildPackage (dist.build-<pid>-<n>) که با rename
      // به dist تبدیل می‌شود؛ اگر build نیمه‌کاره بماند نباید lint را بشکند.
      '**/dist.build-*/**',
      '**/node_modules/**',
      '**/out/**',
      'browser-bundles/**',
      'artifacts/**',
      'coverage/**',
      'docs/**',
      '.docexamples/**',
      '.tsbuild/**',
      'demos/**',
      'ecommerce-demo/**',
      'dashboard/**',
      // #86: فایل‌های قدیمی benchmarks/ دست‌نویس و بدون نگهداری‌اند؛ اسکریپت‌ها و
      // کتابخانه‌های جدید سوئیت (benchmarks/*.js، benchmarks/lib/**) لینت می‌شوند.
      'benchmarks/run-all.js',
      'benchmarks/src/**',
      'benchmarks/ssr/**',
      'benchmarks/runtime/**',
      'benchmarks/resource/**',
      'benchmarks/results/**',
      'index.html',
      '**/*.d.ts',
    ],
  },

  // ── TypeScript sources (typed rules) ──
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/src/**/*.ts', 'packages/**/test/**/*.ts', 'vitest.config.ts'],
    plugins: { zenith: zenithPlugin },
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

      // #55: options-object — پیکربندی positional در سطح عمومی پکیج‌ها.
      'zenith/options-object': 'error',

      // TS type checker already flags undefined names; no-undef is noise.
      'no-undef': 'off',
      // no-console: 'error' برای src پکیج‌ها — بلوک اختصاصی پایین (#143).
      // مهاجرت کد در #39؛ لیست معافیت در scripts/no-console-ratchet.mjs.

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
      // #64: شناسه/توکن/nonce امن باید از crypto.getRandomValues بیاید
      // (secureId). Math.random در source پکیج‌ها ممنوع است؛ استفاده‌های
      // غیرامنیتی (مثل backoff jitter) با eslint-disable + کامنت دلیل.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message:
            'Math.random is banned in package sources (#64). Use secureId() from @zenith/security for ids/tokens/nonces; document non-security uses with an eslint-disable comment.',
        },
      ],
    },
  },

  // ── no-console (#143, SPEC §۲.۳): قانون کلی برای src همهٔ پکیج‌ها error
  // است. معافیت‌ها فقط فایل‌های بدهی #39 در scripts/no-console-ratchet.mjs
  // (فهرست فقط با مهاجرت کوتاه می‌شود — گیت: no-console-ratchet.test.mjs).
  // consoleSink داخل logger با eslint-disable سطرِ فایل استثنا شده است.
  // ──
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.mts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: NO_CONSOLE_RATCHET,
    rules: { 'no-console': 'off' }, // بدهی ثبت‌شدهٔ #39 — با هر مهاجرت یک فایل حذف شود
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

  // ── Build scripts & benchmark suite (untyped, node) ──
  // #86: سوئیت بنچمارک از اسکریپت‌های Node استفاده می‌کند (`benchmarks/*.js`،
  // `benchmarks/lib/**`) — همان قواعد اسکریپت‌های build.
  {
    files: [
      'scripts/**/*.mjs',
      'eslint.config.mjs',
      'benchmarks/*.js',
      'benchmarks/*.mjs',
      'benchmarks/lib/**/*.mjs',
    ],
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
