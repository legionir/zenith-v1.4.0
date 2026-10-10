// #141 — بودجهٔ حجم ≤ ۲KB gzip (SPEC §۲.۱) و ثبت در .size-limit.json.
//
// دو سطح:
//   1) اعلام بودجه: یک ورودی «@zenith/shared» با limit ≤ 2kb در .size-limit.json
//      وجود داشته باشد (اجرای عددی در CI با `npm run size`).
//   2) واقعیت bloat-free: shared نباید کل errors را با خود حمل کند
//      — bundle با external کردن @zenith/* و سپس gzip خود src (بستهٔ واقعی
//      که مصرف‌کننده با tree-shaking می‌بیند) باید ≤ ۲KB باشد.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const sizeLimit = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Array<{
  name: string;
  path: string;
  limit: string;
}>;

describe('shared size budget (#141)', () => {
  it('.size-limit.json declares a ≤ 2kb budget for @zenith/shared', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/shared');
    expect(entry, 'missing @zenith/shared budget').toBeDefined();
    expect(entry!.path).toBe('packages/shared/dist/index.js');
    const kb = parseFloat(entry!.limit);
    expect(kb).toBeLessThanOrEqual(2);
  });

  it('source bundle gzips to ≤ 2KB with @zenith/* externalized', () => {
    // esbuild در devDependencies ریشه است (CI قبل از unit نصب کرده).
    const js = execFileSync(
      'npx',
      [
        'esbuild',
        'packages/shared/src/index.ts',
        '--bundle',
        '--external:@zenith/*',
        '--target=es2022',
        '--format=esm',
        '--minify',
      ],
      { encoding: 'utf8' },
    );
    const gz = gzipSync(Buffer.from(js, 'utf8')).length;
    // ملاک: ۲KB gzip؛ مقدار واقعی باید بسیار کمتر باشد.
    expect(gz, `gzipped src bundle = ${gz} bytes`).toBeLessThanOrEqual(2048);
  });

  it('has a README and LICENSE (package publish hygiene)', () => {
    expect(existsSync('packages/shared/README.md'), 'README.md').toBe(true);
    expect(existsSync('packages/shared/LICENSE'), 'LICENSE').toBe(true);
  });
});
