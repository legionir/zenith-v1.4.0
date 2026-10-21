// #143 — دروازهٔ «no-console با لیستِ مجازِ مرحله‌ای» (کارِ لازم: قاعدهٔ ESLint
// no-console؛ مهاجرت واقعی در #39).
//
// بررسی‌ها:
//   1. eslint.config.mjs قاعدهٔ no-console را برای src پکیج‌ها به 'error'
//      تنظیم کرده و فایل‌های قدیمی را در فهرست مجاز صریح استثنا
//      می‌کند — یعنی قانون کلی برقرار است و فقط بدهی ثبت‌شده معافیت دارد.
//   2. هیچ فایل جدیدی خارج از فهرست مجاز نباید console.* داشته باشد (جلوگیری
//      از رشد بدهی — هر فایلی که #39 مهاجرتش می‌دهد از لیست حذف می‌شود).
//   3. فهرست کهنه نشود: فایلی که دیگر console.* ندارد باید از لیست برود.
//   4. استثنای اصلی: خودِ packages/logger (consoleSink تنها مصرف‌کنندهٔ
//      console است و SPEC آن را صریحاً مجاز می‌داند).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const CONSOLE_RE =
  /\bconsole\s*\.\s*(?:log|warn|error|info|debug|trace|table|group|groupEnd|groupCollapsed|time|timeEnd|count|assert)\b/;

/** همهٔ فایل‌های src/*.ts (بدون d.ts) در کل ورک‌اسپیس که console.* دارند. */
function consoleFiles() {
  const files = new Set();
  for (const parent of ['packages', 'tools']) {
  for (const d of readdirSync(parent, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (d.name === 'tmp-scaffold-verify') continue; // ردّ دریکتوری گذرای scaffold موازی
    const base = join(parent, d.name, 'src');
    if (!existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of readdirSync(cur, { withFileTypes: true })) {
        const p = join(cur, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
          if (CONSOLE_RE.test(readFileSync(p, 'utf8'))) files.add(p.split('\\').join('/'));
        }
      }
    }
  }
  }
  return files;
}

import { NO_CONSOLE_RATCHET } from '../no-console-ratchet.mjs';

describe('no-console rule + ratchet (#143)', () => {
  const eslintConfig = readFileSync('eslint.config.mjs', 'utf8');
  const files = consoleFiles();
  const ratchet = new Set(NO_CONSOLE_RATCHET);

  it('eslint config enables no-console:error for package src (was off pending #39)', () => {
    expect(eslintConfig).toMatch(/'no-console':\s*'error'/);
    expect(eslintConfig).not.toMatch(/'no-console':\s*'off'/);
  });

  it('the allowed list is exactly the set of legacy console.* files (no drift)', () => {
    const offenders = [...files].filter(
      (f) => !ratchet.has(f) && f !== 'packages/logger/src/sinks.ts',
    );
    expect(
      offenders,
      'فایل جدید با console.* — لاگ را به @zenith/logger بسپارید (#143/#39)',
    ).toEqual([]);
    const stale = [...ratchet].filter((f) => !files.has(f));
    expect(stale, 'این فایل‌ها دیگر console ندارند؛ از فهرست حذفشان کن (#39 پیش می‌رود)').toEqual(
      [],
    );
  });

  it('has no legacy exemptions', () => {
    expect(NO_CONSOLE_RATCHET).toEqual([]);
  });
});
