// #144 — بودجه ≤۳KB gzip (SPEC §۲.۴) + ثبت در .size-limit.json + فایل‌های اجباری.
// الگوی #141/#143: esbuild از devDependencies ریشه با execFileSync (بدون import
// مستقیم که cruiser «src نباید به devDep وابسته باشد» را فعال کند).
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const sizeLimit = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Array<{
  name: string;
  path: string;
  limit: string;
}>;

describe('@zenith/cache size budget ≤ 3KB (#144)', () => {
  it('.size-limit.json declares a ≤ 3kb budget for @zenith/cache', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/cache');
    expect(entry, 'missing @zenith/cache budget').toBeDefined();
    expect(entry!.path).toBe('packages/cache/dist/index.js');
    const kb = parseFloat(entry!.limit);
    expect(kb).toBeLessThanOrEqual(3);
  });

  it('source bundle gzips to ≤ 3KB with @zenith/* externalized', () => {
    const js = execFileSync(
      'npx',
      [
        'esbuild',
        'packages/cache/src/index.ts',
        '--bundle',
        '--external:@zenith/*',
        '--target=es2022',
        '--format=esm',
        '--minify',
      ],
      { encoding: 'utf8' },
    );
    const gz = gzipSync(Buffer.from(js, 'utf8')).length;
    expect(gz, `gzipped src bundle = ${gz} bytes`).toBeLessThanOrEqual(3072);
  });

  it('has a README and LICENSE (package publish hygiene)', () => {
    expect(existsSync('packages/cache/README.md'), 'README.md').toBe(true);
    expect(existsSync('packages/cache/LICENSE'), 'LICENSE').toBe(true);
  });
});
