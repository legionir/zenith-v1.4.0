#!/usr/bin/env node
/**
 * #83 — Per-package Size Budget Validator & CI Markdown Summary Generator (`scripts/size-report.mjs`)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export function parseKbLimit(limitStr) {
  const m = String(limitStr)
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*kb$/i);
  if (!m) throw new Error(`Invalid size limit format: ${limitStr}`);
  return Math.round(Number(m[1]) * 1024);
}

export function checkSizeLimitCoverage(rootDir = process.cwd()) {
  const sizeLimitPath = join(rootDir, '.size-limit.json');
  const entries = JSON.parse(readFileSync(sizeLimitPath, 'utf8'));
  const configuredPaths = new Set(entries.map((e) => e.path));
  const packagesDir = join(rootDir, 'packages');
  const missing = [];

  for (const dir of readdirSync(packagesDir).sort()) {
    const srcIndex = join(packagesDir, dir, 'src', 'index.ts');
    if (!existsSync(srcIndex)) continue;
    const expectedDist = `packages/${dir}/dist/index.js`;
    if (!configuredPaths.has(expectedDist)) {
      missing.push(expectedDist);
    }
  }

  return {
    ok: missing.length === 0,
    totalConfigured: entries.length,
    missing,
    entries,
  };
}

export function generateSizeReportMarkdown(rootDir = process.cwd()) {
  const { entries } = checkSizeLimitCoverage(rootDir);
  const lines = [
    '### 📦 Package & Bundle Size Budgets (`#83`)',
    '',
    '| Entry | Path | Gzip Size | Budget | Status |',
    '|---|---|---:|---:|:---:|',
  ];

  for (const entry of entries) {
    const full = join(rootDir, entry.path);
    const limitBytes = parseKbLimit(entry.limit);
    if (!existsSync(full)) {
      lines.push(`| \`${entry.name}\` | \`${entry.path}\` | — | ${entry.limit} | ⏳ (not built) |`);
      continue;
    }
    const gzBytes = gzipSync(readFileSync(full)).length;
    const gzKb = `${(gzBytes / 1024).toFixed(2)} KB`;
    const pass = gzBytes <= limitBytes;
    lines.push(
      `| \`${entry.name}\` | \`${entry.path}\` | ${gzKb} | ${entry.limit} | ${pass ? '✅' : '❌'} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const cov = checkSizeLimitCoverage(process.cwd());
  if (!cov.ok) {
    console.error(`❌ [size-report] Missing .size-limit.json entries: ${cov.missing.join(', ')}`);
    process.exit(1);
  }
  if (process.argv.includes('--markdown')) {
    console.log(generateSizeReportMarkdown(process.cwd()));
  } else {
    console.log(`✅ size-report (#83): all ${cov.totalConfigured} entries covered in .size-limit.json.`);
  }
}
