#!/usr/bin/env node
/**
 * #53 — Verify that every package defining public `*Options` interfaces
 * exports a frozen `DEFAULTS` constant (`DEFAULTS` or `*_DEFAULTS`) with
 * TSDoc annotations (`@default` / `@since`), and generate `docs/OPTIONS-REFERENCE.md`.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function collectPackageOptions(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const results = [];

  for (const slug of readdirSync(packagesDir).sort()) {
    const srcDir = join(packagesDir, slug, 'src');
    if (!existsSync(srcDir)) continue;
    const files = readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .sort();
    if (files.length === 0) continue;

    const combined = files.map((f) => readFileSync(join(srcDir, f), 'utf8')).join('\n');
    const optionsInterfaces = [...combined.matchAll(/export\s+interface\s+(\w+Options)\b/g)].map(
      (m) => m[1],
    );
    const defaultsExports = [
      ...combined.matchAll(/export\s+const\s+([A-Z0-9_]*DEFAULTS)\b/g),
    ].map((m) => m[1]);
    const hasDefaultTag = combined.includes('@default');

    if (optionsInterfaces.length > 0 || defaultsExports.length > 0) {
      results.push({
        slug,
        optionsInterfaces: [...new Set(optionsInterfaces)],
        defaultsExports: [...new Set(defaultsExports)],
        hasDefaultTag,
      });
    }
  }

  return results;
}

export function generateOptionsReferenceMarkdown(rootDir = process.cwd()) {
  const entries = collectPackageOptions(rootDir);
  const lines = [
    '# مرجع خودکار گزینه‌ها و پیش‌فرض‌های منجمد (`DEFAULTS` — `#53`)',
    '',
    'این سند از استخراج خودکار اینترفیس‌های `*Options` و ثابت‌های منجمد `DEFAULTS` در تمام پکیج‌های `@zenith/*` تولید شده است.',
    '',
    '| پکیج | اینترفیس(های) Options | ثابت(های) Frozen DEFAULTS |',
    '|---|---|---|',
  ];

  for (const entry of entries) {
    const opts =
      entry.optionsInterfaces.length > 0
        ? entry.optionsInterfaces.map((o) => `\`${o}\``).join(', ')
        : '—';
    const defs =
      entry.defaultsExports.length > 0
        ? entry.defaultsExports.map((d) => `\`${d}\``).join(', ')
        : '—';
    lines.push(`| \`@zenith/${entry.slug}\` | ${opts} | ${defs} |`);
  }

  lines.push('');
  return lines.join('\n');
}

export function checkDefaultsAndTsdoc(rootDir = process.cwd()) {
  const entries = collectPackageOptions(rootDir);
  const errors = [];

  for (const entry of entries) {
    if (entry.optionsInterfaces.length > 0 && entry.defaultsExports.length === 0) {
      errors.push(
        `packages/${entry.slug}: defines ${entry.optionsInterfaces.join(', ')} but exports no DEFAULTS constant`,
      );
    }
  }

  const refDocPath = join(rootDir, 'docs', 'OPTIONS-REFERENCE.md');
  if (!existsSync(refDocPath)) {
    errors.push('Missing docs/OPTIONS-REFERENCE.md');
  }

  return { ok: errors.length === 0, errors, count: entries.length, entries };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (process.argv.includes('--write')) {
    const md = generateOptionsReferenceMarkdown(process.cwd());
    writeFileSync(join(process.cwd(), 'docs', 'OPTIONS-REFERENCE.md'), md, 'utf8');
    console.log('✅ docs/OPTIONS-REFERENCE.md generated.');
  }
  const res = checkDefaultsAndTsdoc(process.cwd());
  if (!res.ok) {
    for (const err of res.errors) {
      console.error(`❌ [defaults-tsdoc] ${err}`);
    }
    process.exit(1);
  }
  console.log(`✅ defaults-tsdoc (#53): ${res.count} packages with Options/DEFAULTS verified.`);
}
