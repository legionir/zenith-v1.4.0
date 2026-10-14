// Tests for shared tsconfig.base.json (#41)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tsconfig.base.json (#41)', () => {
  it('defines strict, uniform compilerOptions in root tsconfig.base.json', () => {
    const basePath = join(process.cwd(), 'tsconfig.base.json');
    expect(existsSync(basePath)).toBe(true);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    expect(base.compilerOptions).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noImplicitOverride: true,
      isolatedModules: true,
    });
  });

  it('every packages/*/tsconfig.json extends ../../tsconfig.base.json and is under 15 lines', () => {
    const dirs = readdirSync('packages', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      // ردّ دریکتوری گذرای scaffold موازی تست new-package (#172)
      .filter((d) => d.name !== 'tmp-scaffold-verify')
      .map((d) => d.name)
      .filter((d) => existsSync(join('packages', d, 'tsconfig.json')));

    expect(dirs.length).toBeGreaterThanOrEqual(44);
    for (const dir of dirs) {
      const p = join('packages', dir, 'tsconfig.json');
      const raw = readFileSync(p, 'utf8');
      const lines = raw.trim().split('\n');
      expect(lines.length, `${p} line count (${lines.length}) must be < 15`).toBeLessThan(15);
      const parsed = JSON.parse(raw);
      expect(parsed.extends, `${p} extends`).toBe('../../tsconfig.base.json');
    }
  });
});
