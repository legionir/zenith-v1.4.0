// #145 — بودجه ≤۴KB gzip (SPEC §۲.۵) + ثبت در .size-limit.json + فایل‌های اجباری.
// charset=utf8 دقیقاً همان چیزی است که tsc از src فارسیِ source-map‌دار تولید
// می‌کند (literal ها دست‌نخورده) — مثل باندل‌های cache/shared در #144/#141.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const sizeLimit = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Array<{
  name: string;
  path: string;
  limit: string;
}>;

describe('@zenith/storage size budget ≤ 4KB (#145)', () => {
  it('.size-limit.json declares a ≤ 4kb budget for @zenith/storage', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/storage');
    expect(entry, 'missing @zenith/storage budget').toBeDefined();
    expect(entry!.path).toBe('packages/storage/dist/index.js');
    const kb = parseFloat(entry!.limit);
    expect(kb).toBeLessThanOrEqual(4);
  });

  it('source bundle gzips to ≤ 4KB with @zenith/* externalized', () => {
    const js = execFileSync(
      'npx',
      [
        'esbuild',
        'packages/storage/src/index.ts',
        '--bundle',
        '--external:@zenith/*',
        '--target=es2022',
        '--format=esm',
        '--minify',
        '--charset=utf8',
      ],
      { encoding: 'utf8' },
    );
    const gz = gzipSync(Buffer.from(js, 'utf8')).length;
    expect(gz, `gzipped src bundle = ${gz} bytes`).toBeLessThanOrEqual(4096);
  });

  it('has a README and LICENSE (package publish hygiene)', () => {
    expect(existsSync('packages/storage/README.md'), 'README.md').toBe(true);
    expect(existsSync('packages/storage/LICENSE'), 'LICENSE').toBe(true);
  });
});
