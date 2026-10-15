// @vitest-environment node
//
// #112 (DX) — گیت مستندات خطا:
//   ۱) هر کد کاتالوگ (۴رقمی/سه‌رقمی/DEPR) صفحهٔ مستقل docs/errors/<code>.md دارد
//      و صفحه‌ها با کاتالوگ هم‌گام‌اند (drift).
//   ۲) هر صفحه «علت / نمونهٔ کد خطادار / رفع» و لینک docsUrl دارد.
//   ۳) خروجی خطا لینک مستندات را چاپ می‌کند (toUserString).
//   ۴) اسکریپت CI `scripts/check-error-docs.mjs` واقعاً گیت می‌کند (پروب منفی).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnNode } from '../../scripts/lib/proc.mjs';
import { buildErrorDocs, catalog } from '../../scripts/lib/error-docs.mjs';
import { DOMAIN_SAMPLES } from '../../scripts/lib/error-doc-samples.mjs';

const ROOT = process.cwd();
const { files } = buildErrorDocs();
const allCodes = [
  ...catalog.reserved.map((e) => e.code),
  ...catalog.legacy.map((e) => e.code),
  ...catalog.deprecations.map((e) => e.code),
];

describe('#112 error docs pages', () => {
  it('builds a page per catalog code (no duplicates, no gaps)', () => {
    expect(allCodes.length).toBeGreaterThan(100);
    for (const code of allCodes) {
      expect(files.has(join('docs/errors', `${code}.md`)), `page for ${code}`).toBe(true);
    }
    expect(files.has(join('docs/errors', 'README.md'))).toBe(true);
    expect(files.has('docs/ERROR-CODES.md')).toBe(true);
  });

  it('every page documents cause, failing sample, fix and the docsUrl', () => {
    for (const code of allCodes) {
      const body = files.get(join('docs/errors', `${code}.md`));
      expect(body).toContain('## علت');
      expect(body).toContain('## نمونهٔ کد خطادار');
      expect(body).toContain('## رفع');
      expect(body).toContain(`https://zenith.dev/errors/${code}`);
    }
  });

  it('covers every catalog domain with a sample template and keeps the fa suggestion verbatim', () => {
    for (const entry of catalog.reserved) {
      expect(DOMAIN_SAMPLES[entry.domain], `sample for domain ${entry.domain}`).toBeTruthy();
      const body = files.get(join('docs/errors', `${entry.code}.md`));
      expect(body).toContain(entry.faSuggestion);
      expect(body).toContain(entry.fa);
    }
  });

  it('pages on disk are in sync with the catalog (no drift)', () => {
    const stale = [];
    for (const [rel, body] of files) {
      const abs = join(ROOT, rel);
      if (!existsSync(abs) || readFileSync(abs, 'utf8') !== body) stale.push(rel);
    }
    expect(stale).toEqual([]);
  });

  it('check-error-docs.mjs gates the repo and fails on a stale page (negative probe)', () => {
    const ok = spawnNode('scripts/check-error-docs.mjs', [], { cwd: ROOT, encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('مستندات خطا کامل است');

    const page = join(ROOT, 'docs/errors/ZEN-1001.md');
    const original = readFileSync(page, 'utf8');
    try {
      writeFileSync(page, `${original}\n<!-- drifted -->\n`);
      const bad = spawnNode('scripts/check-error-docs.mjs', [], { cwd: ROOT, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain('ZEN-1001.md');
    } finally {
      writeFileSync(page, original);
    }

    // صفحهٔ اضافه/یتیم هم باید گیت شود.
    const orphan = join(ROOT, 'docs/errors/ZEN-9999.md');
    try {
      writeFileSync(orphan, '# orphan\n');
      const bad = spawnNode('scripts/check-error-docs.mjs', [], { cwd: ROOT, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain('orphan page');
    } finally {
      rmSync(orphan, { force: true });
    }
  });
});
