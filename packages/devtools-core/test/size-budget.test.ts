// #147 — بودجهٔ اندازهٔ @zenith/devtools-core (≤ 4KB brotli).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sizeLimit = JSON.parse(
  readFileSync(join(process.cwd(), '.size-limit.json'), 'utf8'),
) as Array<{ name: string; path: string; limit: string }>;

describe('@zenith/devtools-core size budget ≤ 4KB (#147)', () => {
  it('.size-limit.json declares a ≤ 4kb budget for @zenith/devtools-core', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/devtools-core');
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('packages/devtools-core/dist/index.js');
    expect(entry?.limit.toLowerCase()).toBe('4 kb');
  });
});
