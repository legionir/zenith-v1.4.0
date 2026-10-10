// #141 / DEC-021 — دروازهٔ «تست نوع» برای @zenith/shared.
//
// test/types.test-d.ts با `expectTypeOf` نوشته شده است (DEC-021: tsd رد شد؛
// الزام پذیرش با تست نوع قفل می‌شود). مکانیزم expectTypeOf در vitest همین است:
// tsc روی فایل run می‌شود و mismatch به شکل compile error ظاهر می‌شود. پس
// دروازه = اجرای tsc با tsconfig.tests.json (paths → src، noEmit) و انتظار
// خروج ۰. اگر برند/امضای `get` در state تغییر کند و با Readable نخواند، این
// تست قرمز می‌شود.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('shared type test (DEC-021 / #141)', () => {
  it('tsc accepts the expectTypeOf assertions in types.test-d.ts', () => {
    const cfg = 'packages/shared/tsconfig.tests.json';
    expect(existsSync(cfg), cfg).toBe(true);
    expect(() =>
      execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', cfg], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('the type test asserts signal/computed satisfy Readable (no shared→state import)', () => {
    const text = readFileSync('packages/shared/test/types.test-d.ts', 'utf8');
    expect(text).toContain('expectTypeOf');
    expect(text).toMatch(/Readable<number>/);
    // چرخه ممنوع: خودِ src هیچ import از state ندارد (layering.test.ts هم چک
    // می‌کند؛ اینجا فقط test مجاز به import state برای الزام DEC-021 است).
    expect(text).toContain('@zenith/state');
  });
});
