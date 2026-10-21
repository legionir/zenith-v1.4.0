#!/usr/bin/env node
/** #38 — published declarations, all subpaths/conditions and referenced workspace types. */
import { declarationEntries, inspectDeclarationApi } from './lib/declaration-api.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_ANY_PACKAGES = new Set([
  'cache',
  'codemod',
  'create-zenith',
  'data-table',
  'devtools-core',
  'errors',
  'expressions',
  'i18n',
  'jalali',
  'language-server',
  'logger',
  'notifications',
  'router',
  'runtime',
  'runtime-core',
  'scheduler',
  'service-worker',
  'schema',
  'shared',
  'ssr',
  'state',
  'storage',
  'templates',
  'transition',
  'unplugin-zenith',
  'virtual-list',
  'zenith',
]);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function auditSourceBarrelAnyInventory(rootDir = process.cwd()) {
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

/** Missing declarations are an error, never a clean zero-any result. */
export function auditPublicEntrypointAny(rootDir = process.cwd()) {
  const entries = declarationEntries(rootDir);
  if (!entries.length) throw new Error('No published declaration entries found');
  const analysis = inspectDeclarationApi(entries, { includeDirectories: [join(rootDir, 'packages')] });
  const counts = Object.fromEntries([...new Set(entries.map(e => e.packageName))].map(name => [name, 0]));
  for (const finding of analysis.any) {
    for (const name of Object.keys(counts)) if (finding.exposedBy.some(entry => entry.startsWith(`${name}.:`) || entry.startsWith(`${name}./`))) counts[name]++;
  }
  return { counts, totalAnyInEntrypoints: analysis.any.length, zeroAnyPackagesCount: Object.values(counts).filter(count => count === 0).length, violations: analysis.any, entries: entries.length };
}

/**
 * #38 — Internal `any` ratchet (src کل؛ تست‌ها و کامنت‌ها کنار گذاشته می‌شوند).
 *
 * مسیر مهاجرت: شمار کلی در تست api-surface-docs پین می‌شود و فقط می‌تواند
 * کم شود (سقف نزولی)؛ هدف نهایی طبق معیار پذیرش #38، ≤ ۱۰۰ با کامنت توجیه
 * برای موارد باقی‌مانده است. این inventory منبع، شاهد صفر بودن API نیست؛ declaration graph بالا مرجع است.
 */
export function auditSrcAnyTotals(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const pat = /(?::\s*any\b|<any>|as\s+any\b|any\[\])/g;
  const perPackage = {};
  let grandTotal = 0;
  for (const d of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const srcDir = join(packagesDir, d.name, 'src');
    if (!existsSync(srcDir)) continue;
    let n = 0;
    const walk = (dir) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) {
          if (f.name === '__tests__' || f.name === 'test' || f.name === 'tests') continue;
          walk(p);
        } else if (
          f.name.endsWith('.ts') &&
          !f.name.includes('.test.') &&
          !f.name.endsWith('.spec.ts')
        ) {
          const clean = stripComments(readFileSync(p, 'utf8'));
          const m = clean.match(pat);
          if (m) n += m.length;
        }
      }
    };
    walk(srcDir);
    if (n > 0) perPackage[d.name] = n;
    grandTotal += n;
  }
  return { perPackage, grandTotal };
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
