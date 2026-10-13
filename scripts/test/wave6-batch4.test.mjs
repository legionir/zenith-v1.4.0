// scripts/test/wave6-batch4.test.mjs
// Wave 6 Batch 4 (P2 repo/CI/docs quality): #42 hoist devDeps، #43 کد مرده،
// #44 انتقال تصویر پیش‌نمایش، #78 SBOM+license، #81 ماتریس OS، #82 کش build،
// #84 benchmark CI، #85 قالب‌های Issue/PR.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const wf = read('.github', 'workflows', 'main.yml');
const rootPkg = JSON.parse(read('package.json'));

describe('Wave 6 P2 Batch 4 — repo/CI/docs quality (#42,#43,#44,#78,#81,#82,#84,#85)', () => {
  it('#42: typescript/@types/node/tsx فقط در ریشه پین شده‌اند (نه per-package)', () => {
    const BANNED = ['typescript', '@types/node', 'tsx'];
    expect(rootPkg.devDependencies.typescript, 'root typescript').toBeTruthy();
    expect(rootPkg.devDependencies['@types/node'], 'root @types/node').toBeTruthy();
    for (const dir of readdirSync(join(root, 'packages'))) {
      const manifest = join(root, 'packages', dir, 'package.json');
      if (!existsSync(manifest)) continue;
      const j = JSON.parse(readFileSync(manifest, 'utf8'));
      for (const banned of BANNED) {
        expect(
          j.devDependencies?.[banned],
          `packages/${dir}/package.json devDependencies.${banned} باید حذف شده باشد`,
        ).toBeUndefined();
      }
    }
  });

  it('#43: کامنت‌های ردیابی («Real cleanup:»/«Listener cleanup added») در packages وجود ندارد', () => {
    const banned = /Real cleanup:|Listener cleanup added/;
    for (const dir of readdirSync(join(root, 'packages'))) {
      const srcDir = join(root, 'packages', dir, 'src');
      if (!existsSync(srcDir)) continue;
      for (const f of readdirSync(srcDir)) {
        if (!f.endsWith('.ts')) continue;
        const text = readFileSync(join(srcDir, f), 'utf8');
        expect(banned.test(text), `${dir}/src/${f}`).toBe(false);
      }
    }
  });

  it('#44: ecommerce-preview.png در ریشه نیست و در docs/assets/ قرار دارد', () => {
    expect(existsSync(join(root, 'ecommerce-preview.png'))).toBe(false);
    expect(existsSync(join(root, 'docs', 'assets', 'ecommerce-preview.png'))).toBe(true);
  });

  it('#78: اسکریپت SBOM خروجی CycloneDX 1.5 معتبر با metadata صحیح تولید می‌کند', () => {
    const out = join(tmpdir(), 'zenith-sbom-test.json');
    execFileSync('node', [join(root, 'scripts', 'generate-sbom.mjs'), out], { stdio: 'pipe' });
    const sbom = JSON.parse(readFileSync(out, 'utf8'));
    expect(sbom.bomFormat).toBe('CycloneDX');
    expect(sbom.specVersion).toBe('1.5');
    expect(sbom.metadata.component.version).toBe(rootPkg.version);
    expect(Array.isArray(sbom.components)).toBe(true);
    expect(sbom.components.length).toBeGreaterThan(50);
    const sample = sbom.components[0];
    expect(sample.type).toBe('library');
    expect(sample.purl).toMatch(/^pkg:npm\//);
  });

  it('#78: license check با allowlist مجوزهای سازگار اجرا و اسکریپت ریشه وجود دارد', () => {
    expect(rootPkg.scripts['make:sbom']).toBe('node scripts/generate-sbom.mjs');
    expect(rootPkg.scripts['license:check']).toBe('node scripts/check-licenses.mjs');
    const src = read('scripts', 'check-licenses.mjs');
    expect(src).toContain("'MIT'");
    expect(src).toContain('MPL-2.0'); // lightningcss — سازگار مدارک‌دار
  });

  it('#81: CI ماتریس سیستم‌عامل (windows/macos) دارد که تست‌ها را اجرا می‌کند', () => {
    expect(wf).toContain('unit-os-matrix:');
    expect(wf).toContain('os: [windows-latest, macos-latest]');
    expect(wf).toContain('runs-on: ${{ matrix.os }}');
    expect(wf).toContain('npx vitest run scripts/test/');
  });

  it('#82: jobهای مصرف‌کنندهٔ build از dist cache استفاده می‌کنند و build شرطی است', () => {
    const cacheCount = (wf.match(/Restore dist cache \(#82\)/g) ?? []).length;
    expect(cacheCount).toBe(4); // package-lint / peer-single-instance / size / e2e
    expect(wf).toContain('packages/*/dist');
    expect(wf).toContain('actions/cache@v4');
    const condCount = (wf.match(/cache-hit != 'true'/g) ?? []).length;
    expect(condCount).toBe(4);
  });

  it('#84: بنچمارک CI با بودجهٔ عملکرد در workflow اجرا می‌شود', () => {
    expect(wf).toContain('benchmark:');
    expect(wf).toContain('npm run bench:ci');
    expect(rootPkg.scripts['bench:ci']).toBe('node scripts/benchmark-ci.mjs');
    const budgets = JSON.parse(read('benchmarks', 'budgets.json'));
    expect(budgets.signalsCreateSet).toBeGreaterThan(0);
    const script = read('scripts', 'benchmark-ci.mjs');
    expect(script).toContain('SLACK');
    expect(script).toContain('opsPerSec');
  });

  it('#85: قالب‌های Issue/PR با چک‌لیست انطباق API-CONVENTIONS وجود دارند', () => {
    const bug = read('.github', 'ISSUE_TEMPLATE', 'bug_report.yml');
    expect(bug).toContain('گزارش باگ');
    expect(read('.github', 'ISSUE_TEMPLATE', 'feature_request.yml')).toContain('API-CONVENTIONS');
    const pr = read('.github', 'PULL_REQUEST_TEMPLATE.md');
    expect(pr).toContain('docs/API-CONVENTIONS.md');
    expect(pr).toContain('ZenithError');
    expect(pr).toContain('cleanup');
  });
});
