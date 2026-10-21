import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_SUBPATHS } from '../lib/exports-shape.mjs';
import { generateApiDocs } from '../generate-api-docs.mjs';
import { auditPublicEntrypointAny, auditSrcAnyTotals } from '../check-public-any.mjs';

describe('Public API surface snapshot, TypeDoc reference, conditional exports & public-any audit (#38, #56, #57, #103)', () => {
  it('verifies docs/api/api-surface.snapshot.json is up-to-date and every package has README.md and docs/api/<pkg>.md (#56, #103)', () => {
    const res = generateApiDocs(process.cwd(), { checkOnly: true });
    const keys = Object.keys(res.surface);
    const subpaths = keys.filter((k) => res.surface[k].subpath);
    // 49 پکیج (#147..#149 + #160,#161,#162,#168,#169,#170 ⇒ 41 → 49) + 11 زیرمسیر عمومی
    // (#142/#120: zod/json-schema/attr + storage/signal + core/ssr/testing/presets×3/browser).
    // #158: دو پکیج tooling جدید (create-zenith + templates) ⇒ ۴۹ → ۵۱.
    // #164: پکیج tooling جدید unplugin-zenith ⇒ ۵۱ → ۵۲.
    // #167: پکیج tooling جدید codemod ⇒ ۵۲ → ۵۳.
    expect(keys.length - subpaths.length).toBe(53);
    expect(subpaths.length).toBe(Object.values(PUBLIC_SUBPATHS).reduce((sum, entries) => sum + entries.length, 0));
    expect(existsSync(join(process.cwd(), 'docs/api/INDEX.md'))).toBe(true);

    for (const [, info] of Object.entries(res.surface)) {
      if (info.subpath) continue;
      expect(existsSync(join(process.cwd(), 'packages', info.slug, 'README.md'))).toBe(true);
      expect(existsSync(join(process.cwd(), 'docs/api', `${info.slug}.md`))).toBe(true);
      expect(info.exports.length).toBeGreaterThan(0);
    }
  });

  it('publishes every public subpath in the snapshot and its own reference page (#142/#120)', () => {
    const res = generateApiDocs(process.cwd(), { checkOnly: true });
    const schemaAttr = res.surface['@zenith/schema/attr'];
    expect(schemaAttr).toBeDefined();
    expect(schemaAttr.slug).toBe('schema');
    expect(schemaAttr.entry).toBe('src/attr.ts');
    // نگهبان بودجهٔ ۴KB باندل اصلی schema (#142، DEC-029) باید همان نمادها را بدهد.
    expect(schemaAttr.exports.map((e) => e.name)).toEqual([
      'parseConfigAttr',
      'parseJsonAttr',
      'ParseJsonAttrOptions',
      'parseJsonValue',
    ]);
    expect(existsSync(join(process.cwd(), 'docs/api/schema--attr.md'))).toBe(true);

    // هر زیرمسیر باید صفحهٔ مستقل داشته باشد و اسنپ‌شات به فایل منبعش اشاره کند.
    for (const [key, info] of Object.entries(res.surface)) {
      if (!info.subpath) continue;
      expect(existsSync(join(process.cwd(), 'packages', info.slug, info.entry))).toBe(true);
      const docFile = `${info.slug}--${info.subpath.replace(/\//g, '-')}.md`;
      expect(existsSync(join(process.cwd(), 'docs/api', docFile)), `${key} → ${docFile}`).toBe(
        true,
      );
      // زیرمسیری که صفر نماد دارد حتماً از پکیج دیگری بازصادر می‌کند.
      if (info.exports.length === 0) expect(info.reexports?.length).toBeGreaterThan(0);
    }

    // INDEX.md باید همهٔ زیرمسیرها را با specifier کامل فهرست کند.
    const index = readFileSync(join(process.cwd(), 'docs/api/INDEX.md'), 'utf8');
    for (const key of Object.keys(res.surface)) {
      if (res.surface[key].subpath) expect(index).toContain(`\`${key}\``);
    }
  });

  it('ensures every package declares zenith.target and ./package.json export and build-package strips __ZENITH_DEV__ in production (#57)', () => {
    const validTargets = new Set(['universal', 'browser', 'node', 'worker']);
    const pkgDirs = readdirSync(join(process.cwd(), 'packages'), { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          // tmp-* = scratch package the scaffold test creates/removes while suites run in parallel
          !d.name.startsWith('tmp-') &&
          existsSync(join(process.cwd(), 'packages', d.name, 'package.json')),
      )
      .map((d) => d.name);

    for (const slug of pkgDirs) {
      const pkg = JSON.parse(
        readFileSync(join(process.cwd(), 'packages', slug, 'package.json'), 'utf8'),
      );
      expect(validTargets.has(pkg.zenith?.target), `${slug} zenith.target`).toBe(true);
      if (pkg.exports && typeof pkg.exports === 'object') {
        expect(pkg.exports['./package.json'], `${slug} ./package.json export`).toBe(
          './package.json',
        );
      }
    }

    const buildScript = readFileSync(join(process.cwd(), 'scripts/build-package.mjs'), 'utf8');
    expect(buildScript).toContain("__ZENITH_DEV__: 'false'");
  });

  it('enforces zero public any across published declarations and referenced workspace types (#38)', () => {
    // Requires a fresh library build. Missing conditions/declarations fail closed;
    // barrel-only zero counts are not evidence for this assertion.
    const res = auditPublicEntrypointAny(process.cwd());
    expect(res.violations).toEqual([]);
    expect(res.zeroAnyPackagesCount).toBeGreaterThanOrEqual(22);
    expect(res.totalAnyInEntrypoints).toBe(0);
  });

  it('pins the internal-any ratchet (src غیرورودی؛ سقف نزولی به سمت هدف ≤۱۰۰، #38)', () => {
    // #38 (2026-10-15): رتچت داخلی با baseline 478 آغاز شد (مقادیر پس از
    // می‌باشد && موج صفر‌سازی entrypoint). این شمار فقط باید با جایگزینی
    // واقعی به unknown/generic/نوع دقیق کاهش یابد — نه با حذف تست یا حرکت
    // کد. هدف معیار پذیرش: ≤ ۱۰۰ مورد باقی‌مانده با کامنت توجیه.
    const res = auditSrcAnyTotals(process.cwd());
    // #55 (2026-10-15): processFetchWithCache سه امضای `Promise<any>` داشت؛ با
    // unknown شدن، سقف رتچت به ۴۷۷ کاهش یافت (فقط نزولی — هرگز بالا نمی‌رود).
    expect(res.grandTotal).toBeLessThanOrEqual(477);
  });
});
