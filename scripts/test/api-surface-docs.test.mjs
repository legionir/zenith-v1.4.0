import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateApiDocs } from '../generate-api-docs.mjs';
import { auditPublicEntrypointAny, auditSrcAnyTotals } from '../check-public-any.mjs';

describe('Public API surface snapshot, TypeDoc reference, conditional exports & public-any audit (#38, #56, #57, #103)', () => {
  it('verifies docs/api/api-surface.snapshot.json is up-to-date and every package has README.md and docs/api/<pkg>.md (#56, #103)', () => {
    const res = generateApiDocs(process.cwd(), { checkOnly: true });
    expect(Object.keys(res.surface).length).toBe(49); // #147..#149 + #160,#161,#162,#168,#169,#170 (41 → 49)
    expect(existsSync(join(process.cwd(), 'docs/api/INDEX.md'))).toBe(true);

    for (const [, info] of Object.entries(res.surface)) {
      expect(existsSync(join(process.cwd(), 'packages', info.slug, 'README.md'))).toBe(true);
      expect(existsSync(join(process.cwd(), 'docs/api', `${info.slug}.md`))).toBe(true);
      expect(info.exports.length).toBeGreaterThan(0);
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

  it('enforces zero public entrypoint any across all package entrypoints (#38)', () => {
    // #38 (2026-10-15): همهٔ ۳۱ any باقی‌ماندهٔ public entrypoint صفر شد
    // (expressions: evaluateExpression→unknown؛ service-worker: ZenLikeForSW
    // structural؛ runtime-core/runtime: تایپ‌های ambient محلی به‌جای cast های
    // untyped برای __zenMemoUnchanged/__zenithDelegationTeardown/__ZENITH_RELOAD__
    // و options?: unknown). سقف کلی entrypoint: صفر مطلق — هر فایل جدید یا
    // هر بازگشت any خطای این تست است.
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
