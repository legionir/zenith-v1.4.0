// #143 — بودجهٔ حجم ≤ ۲KB gzip (SPEC §۲.۳) و ثبت در .size-limit.json.
// الگوی دقیق #141 (declared budget + واقعی externalized + بهداشت انتشار).
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const sizeLimit = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Array<{
  name: string;
  path: string;
  limit: string;
}>;

describe('@zenith/logger size budget (#143)', () => {
  it('.size-limit.json declares a ≤ 2kb budget for @zenith/logger', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/logger');
    expect(entry, 'missing @zenith/logger budget').toBeDefined();
    expect(entry!.path).toBe('packages/logger/dist/index.js');
    const kb = parseFloat(entry!.limit);
    expect(kb).toBeLessThanOrEqual(2);
  });

  it('source bundle gzips to ≤ 2KB with @zenith/* externalized', () => {
    const js = execFileSync(
      'npx',
      [
        'esbuild',
        'packages/logger/src/index.ts',
        '--bundle',
        '--external:@zenith/*',
        '--target=es2022',
        '--format=esm',
        '--minify',
      ],
      { encoding: 'utf8' },
    );
    const gz = gzipSync(Buffer.from(js, 'utf8')).length;
    expect(gz, `gzipped src bundle = ${gz} bytes`).toBeLessThanOrEqual(2048);
  });

  it('has a README and LICENSE (package publish hygiene)', () => {
    expect(existsSync('packages/logger/README.md'), 'README.md').toBe(true);
    expect(existsSync('packages/logger/LICENSE'), 'LICENSE').toBe(true);
  });
});
