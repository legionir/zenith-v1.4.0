import { defineConfig } from 'vitest/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Map every @zenith/<pkg> to its TypeScript source so tests run against src
// (no dist build required) and coverage instruments the real source files.
// Use array form with regex `find` anchored to exact module specifier (plus
// known subpaths) so the general prefix never corrupts subpath imports.
const packagesDir = join(process.cwd(), 'packages');
type AliasEntry = { find: RegExp; replacement: string };
const alias: AliasEntry[] = [
  { find: /^@zenith\/state\/internal$/, replacement: join(packagesDir, 'state/src/internal.ts') },
  { find: /^@zenith\/router\/node$/, replacement: join(packagesDir, 'router/src/node.ts') },
  { find: /^@zenith\/ssr\/edge$/, replacement: join(packagesDir, 'ssr/src/edge.ts') },
  { find: /^@zenith\/errors\/internal$/, replacement: join(packagesDir, 'errors/src/internal.ts') },
  { find: /^@zenith\/ssr\/internal$/, replacement: join(packagesDir, 'ssr/src/internal.ts') },
  { find: /^@zenith\/expressions\/internal$/, replacement: join(packagesDir, 'expressions/src/internal.ts') },
  { find: /^@zenith\/ui\/(position|dialog|popover|tooltip|tabs|menu|accordion|combobox|date-picker|portal)$/, replacement: join(packagesDir, 'ui/src/$1.ts') },
  { find: /^@zenith\/analytics\/legacy$/, replacement: join(packagesDir, 'analytics/src/legacy.ts') },
  { find: /^@zenith\/testing-e2e\/browser$/, replacement: join(packagesDir, 'testing-e2e/src/browser.ts') },
  { find: /^@zenith\/realtime\/(testing|legacy)$/, replacement: join(packagesDir, 'realtime/src/$1.ts') },
  // subpath first: @zenith/service-worker/sw
  {
    find: /^@zenith\/service-worker\/(sw|strategies)$/,
    replacement: join(packagesDir, 'service-worker/src/$1.ts'),
  },
  // #142 — زیرمسیرهای SPEC §۲.۲: @zenith/schema/zod و @zenith/schema/json-schema
  {
    find: /^@zenith\/schema\/zod$/,
    replacement: join(packagesDir, 'schema/src/zod.ts'),
  },
  {
    find: /^@zenith\/schema\/json-schema$/,
    replacement: join(packagesDir, 'schema/src/json-schema.ts'),
  },
  // #120 — مسیر مشترک خواندن attribute (@zenith/schema/attr)
  {
    find: /^@zenith\/schema\/attr$/,
    replacement: join(packagesDir, 'schema/src/attr.ts'),
  },
  // #145 — زیرمسیر SPEC §۲.۵: @zenith/storage/signal
  {
    find: /^@zenith\/storage\/signal$/,
    replacement: join(packagesDir, 'storage/src/signal.ts'),
  },
  // #57 — ورودی dual برنامهٔ CLI (بدون side-effectِ runCli ورودی اصلی).
  {
    find: /^@zenith\/cli\/program$/,
    replacement: join(packagesDir, 'cli/src/program.ts'),
  },
  // #164 — زیرمسیرهای @zenith/unplugin-zenith (پنج bundler)
  {
    find: /^@zenith\/unplugin-zenith\/(vite|rollup|webpack|esbuild|rspack)$/,
    replacement: join(packagesDir, 'unplugin-zenith/src/$1.ts'),
  },
  // #149 — پکیج چتر `zenith` و زیرمسیرهای SPEC §۲.۹
  {
    find: /^zenith\/presets\/(minimal|spa|full)$/,
    replacement: join(packagesDir, 'zenith/src/presets/$1.ts'),
  },
  {
    find: /^zenith\/(core|ssr|testing|browser)$/,
    replacement: join(packagesDir, 'zenith/src/$1.ts'),
  },
  {
    find: /^zenith$/,
    replacement: join(packagesDir, 'zenith/src/index.ts'),
  },
];
for (const dir of readdirSync(packagesDir)) {
  const src = join(packagesDir, dir, 'src', 'index.ts');
  alias.push({ find: new RegExp(`^@zenith/${dir}$`), replacement: src });
}

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    // #146: تست‌های سنگین تقویمی (۱۲۰٬۰۰۰ مقایسه با Intl + اسکن رفت‌وبرگشت
    // ۱۰۰۰..۳۰۰۰) از آستانهٔ پیش‌فرض ۵ ثانیه عبور می‌کنند؛ deterministic و بدون
    // network — فقط طولانی‌اند.
    testTimeout: 20_000,
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.mjs',
      'tools/*/test/**/*.test.ts',
      'tools/*/test/**/*.test.mjs',
      'scripts/test/**/*.test.mjs',
    ],
    globals: false,
    coverage: {
      provider: 'v8',
      // #29: the four core packages must each reach >= 80% statement coverage.
      include: [
        'packages/state/src/**',
        'packages/scheduler/src/**',
        'packages/expressions/src/**',
        'packages/compiler/src/**',
      ],
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        statements: 80,
        'packages/state/src/**': { statements: 80 },
        'packages/scheduler/src/**': { statements: 80 },
        'packages/expressions/src/**': { statements: 80 },
        'packages/compiler/src/**': { statements: 80 },
      },
    },
  },
});
