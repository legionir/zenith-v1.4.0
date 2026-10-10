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
  for (const d of readdirSync('packages', { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const base = join('packages', d.name, 'src');
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
  return files;
}

import { NO_CONSOLE_RATCHET } from '../no-console-ratchet.mjs';

describe('no-console rule + ratchet (#143)', () => {
  const eslintConfig = readFileSync('eslint.config.mjs', 'utf8');
  const files = consoleFiles();
  const ratchet = new Set(NO_CONSOLE_RATCHET);

  it('eslint config enables no-console:error for package src (was off pending #39)', () => {
    expect(eslintConfig).toMatch(/'no-console':\s*'error'/);
    // تنها یک 'off' مجاز است: override مربوط به فهرست بدهی (#39) — نه در قواعد اصلی.
    expect((eslintConfig.match(/'no-console':\s*'off'/g) ?? []).length).toBe(1);
    expect(eslintConfig).toContain('no-console-ratchet.mjs');
    expect(eslintConfig).toContain('NO_CONSOLE_RATCHET');
  });

  it('the allowed list is exactly the set of legacy console.* files (no drift)', () => {
    const offenders = [...files].filter(
      (f) => !ratchet.has(f) && !f.startsWith('packages/logger/'),
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

  it('baseline is exactly the 62 legacy files recorded at #143 time', () => {
    expect(NO_CONSOLE_RATCHET.length).toBe(62);
    // هیچ‌کدام از فایل‌های logger نباید در فهرست باشد (پکیج جدید پاک است).
    expect(NO_CONSOLE_RATCHET.filter((f) => f.startsWith('packages/logger/'))).toEqual([]);
  });
});
