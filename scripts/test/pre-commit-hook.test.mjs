// scripts/test/pre-commit-hook.test.mjs
// #37 — pre-commit با husky + lint-staged: ESLint و Prettier روی فایل‌های staged.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('#37 pre-commit hook (husky + lint-staged)', () => {
  it('prepare نصب hook را خودکار می‌کند و ابزارها devDependency ریشه‌اند', () => {
    expect(pkg.scripts.prepare).toBe('husky');
    expect(pkg.devDependencies.husky).toBeTruthy();
    expect(pkg.devDependencies['lint-staged']).toBeTruthy();
  });

  it('.husky/pre-commit قابل‌اجراست و lint-staged را فراخوانی می‌کند', () => {
    const hook = join(root, '.husky', 'pre-commit');
    expect(existsSync(hook)).toBe(true);
    expect(statSync(hook).mode & 0o111, 'executable bit').not.toBe(0);
    expect(readFileSync(hook, 'utf8')).toContain('lint-staged');
  });

  it('lint-staged: ESLint (fix) + Prettier روی کد؛ Prettier روی json/yml', () => {
    const cfg = pkg['lint-staged'];
    const code = cfg['*.{ts,tsx,js,mjs,cjs}'];
    expect(code.some((c) => c.startsWith('eslint') && c.includes('--fix'))).toBe(true);
    expect(code.some((c) => c.startsWith('prettier'))).toBe(true);
    expect(cfg['*.{json,yml,yaml,css}'].some((c) => c.startsWith('prettier'))).toBe(true);
  });

  it('typecheck/تست سنگین در hook نیست (hook < ۱۰ ثانیه)', () => {
    const all = JSON.stringify(pkg['lint-staged']);
    expect(all).not.toMatch(/typecheck|vitest|npm test|tsc/);
  });

  it('CONTRIBUTING راه دور زدن (--no-verify) و گیت‌بودن CI را مستند می‌کند', () => {
    const doc = readFileSync(join(root, 'CONTRIBUTING.md'), 'utf8');
    expect(doc).toContain('--no-verify');
    expect(doc).toMatch(/CI همچنان گیت اصلی/);
  });
});
