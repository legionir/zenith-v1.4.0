// #146 — بودجه ≤۴KB gzip (SPEC §۲.۶) + ثبت در .size-limit.json + فایل‌های اجباری.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const sizeLimit = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Array<{
  name: string;
  path: string;
  limit: string;
}>;

describe('@zenith/jalali size budget ≤ 4KB (#146)', () => {
  it('.size-limit.json declares a ≤ 4kb budget for @zenith/jalali', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/jalali');
    expect(entry, 'missing @zenith/jalali budget').toBeDefined();
    expect(entry!.path).toBe('packages/jalali/dist/index.js');
    const kb = parseFloat(entry!.limit);
    expect(kb).toBeLessThanOrEqual(4);
  });

  it('source bundle gzips to ≤ 4KB with @zenith/* externalized', () => {
    const js = execFileSync(
      'npx',
      [
        'esbuild',
        'packages/jalali/src/index.ts',
        '--bundle',
        '--external:@zenith/*',
        '--target=es2022',
        '--format=esm',
        '--minify',
      ],
      { encoding: 'utf8' },
    );
    const gz = gzipSync(Buffer.from(js, 'utf8')).length;
    expect(gz, `gzipped src bundle = ${gz} bytes`).toBeLessThanOrEqual(4096);
  });

  it('has a README and LICENSE (package publish hygiene)', () => {
    expect(existsSync('packages/jalali/README.md'), 'README.md').toBe(true);
    expect(existsSync('packages/jalali/LICENSE'), 'LICENSE').toBe(true);
  });
});
