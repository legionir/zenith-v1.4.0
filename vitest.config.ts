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
  // subpath first: @zenith/service-worker/sw
  {
    find: /^@zenith\/service-worker\/sw$/,
    replacement: join(packagesDir, 'service-worker/src/sw.ts'),
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
    include: ['packages/*/test/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      // #27: the four core packages must each reach >= 70% statement coverage.
      // (service-worker / other packages are covered by their own targeted tests
      // but are not part of the "core" coverage gate yet.)
      include: [
        'packages/state/src/**',
        'packages/scheduler/src/**',
        'packages/expressions/src/**',
        'packages/compiler/src/**',
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 70,
      },
    },
  },
});
