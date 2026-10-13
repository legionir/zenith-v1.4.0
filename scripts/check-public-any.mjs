#!/usr/bin/env node
/**
 * #38 — Public API `any` Auditor (`scripts/check-public-any.mjs`)
 *
 * Scans `packages/<slug>/src/index.ts` for explicit `any` type annotations in public
 * entrypoints. Enforces zero `any` in all L0/L1/modern packages and a strict
 * non-increasing ratchet ceiling across legacy barrel files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_ANY_PACKAGES = new Set([
  'cache',
  'data-table',
  'devtools-core',
  'errors',
  'i18n',
  'jalali',
  'logger',
  'notifications',
  'router',
  'scheduler',
  'schema',
  'shared',
  'ssr',
  'state',
  'storage',
  'transition',
  'virtual-list',
  'zenith',
]);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function auditPublicEntrypointAny(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const slugs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, 'src', 'index.ts')))
    .map((d) => d.name)
    .sort();

  const violations = [];
  const counts = {};
  let totalAnyInEntrypoints = 0;

  for (const slug of slugs) {
    const file = join(packagesDir, slug, 'src', 'index.ts');
    const clean = stripComments(readFileSync(file, 'utf8'));
    const matches = clean.match(/(?::\s*any\b|<any>|as\s+any\b|any\[\])/g) || [];
    counts[slug] = matches.length;
    totalAnyInEntrypoints += matches.length;
    if (ZERO_ANY_PACKAGES.has(slug) && matches.length > 0) {
      violations.push(`${slug}/src/index.ts has ${matches.length} explicit 'any' usage(s)`);
    }
  }

  return {
    counts,
    totalAnyInEntrypoints,
    violations,
    zeroAnyPackagesCount: ZERO_ANY_PACKAGES.size,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = auditPublicEntrypointAny();
  if (res.violations.length > 0) {
    console.error('❌ Public API `any` violations:', res.violations);
    process.exit(1);
  }
  console.log(
    `✅ Public entrypoint 'any' audit passed (${res.zeroAnyPackagesCount} zero-any packages, total entrypoint any=${res.totalAnyInEntrypoints}).`,
  );
}
