import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkSizeLimitCoverage,
  generateSizeReportMarkdown,
  parseKbLimit,
} from '../size-report.mjs';

describe('Per-package & bundle size-limit budgets (#83)', () => {
  it('covers every workspace package with src/index.ts plus presets and browser bundle in .size-limit.json', () => {
    const res = checkSizeLimitCoverage(process.cwd());
    expect(res.missing).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.totalConfigured).toBeGreaterThanOrEqual(47);
  });

  it('generates a Markdown size table for CI summaries and parses KB budgets', () => {
    expect(parseKbLimit('4 kb')).toBe(4096);
    const md = generateSizeReportMarkdown(process.cwd());
    expect(md).toContain('| `@zenith/state` |');
    expect(md).toContain('| `@zenith/runtime` |');
    expect(md).toContain('| `zenith (preset: minimal)` |');

    const wf = readFileSync(join(process.cwd(), '.github/workflows/main.yml'), 'utf8');
    expect(wf).toContain('node scripts/size-report.mjs --markdown');
  });
});
