// #148 — بودجهٔ اندازهٔ @zenith/runtime-core (≤ 8KB brotli).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sizeLimit = JSON.parse(
  readFileSync(join(process.cwd(), '.size-limit.json'), 'utf8'),
) as Array<{ name: string; path: string; limit: string }>;

describe('@zenith/runtime-core size budget ≤ 8KB (#148)', () => {
  it('.size-limit.json declares a ≤ 8kb budget for @zenith/runtime-core', () => {
    const entry = sizeLimit.find((e) => e.name === '@zenith/runtime-core');
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('packages/runtime-core/dist/index.js');
    expect(entry?.limit.toLowerCase()).toBe('8 kb');
  });
});
