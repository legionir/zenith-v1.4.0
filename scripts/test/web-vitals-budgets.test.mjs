// #90 — unit + consistency tests for the Web Vitals gate. The budgets module
// is the single source of numbers; lighthouserc.cjs requires it directly, and
// the Playwright spec (TS ESM, cannot require CJS) is pinned here by text so
// the three cannot drift apart. Real browser execution stays in validation
// (needs dist builds + the reference machine).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import budgetsModule from '../web-vitals-budgets.cjs';

const { BUDGETS, PROFILE, VITAL_URLS, summarizeRuns, checkVitals } = budgetsModule;

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('#90 — budgets match the acceptance criterion', () => {
  it('fixes LCP/INP/CLS/Performance thresholds and the 5-run plan', () => {
    expect(BUDGETS.lcpMs).toBe(2500);
    expect(BUDGETS.inpMs).toBe(200);
    expect(BUDGETS.cls).toBe(0.1);
    expect(BUDGETS.performanceScore).toBe(0.9);
    expect(BUDGETS.runs).toBe(5);
    expect(VITAL_URLS).toEqual([
      'http://127.0.0.1:8089/ecommerce-demo/index.html',
      'http://127.0.0.1:8089/dashboard/index.html',
    ]);
  });

  it('fixes the shared 4x-CPU / 4G profile in both unit systems', () => {
    expect(PROFILE.cpuThrottlingRate).toBe(4);
    expect(PROFILE.rttMs).toBe(150);
    expect(PROFILE.throughputKbps).toBe(1638);
    expect(PROFILE.downloadThroughputBps).toBe(1638 * 1024);
    expect(PROFILE.uploadThroughputBps).toBe(750 * 1024);
    expect(PROFILE.latencyMs).toBe(150);
  });
});

describe('#90 — verdict logic (pure)', () => {
  it('passes a clean page view', () => {
    expect(checkVitals({ lcpMs: 1800, inpMs: 120, cls: 0.05 })).toEqual({ pass: true, failures: [] });
  });

  it('passes exactly on the boundary values', () => {
    expect(checkVitals({ lcpMs: 2500, inpMs: 200, cls: 0.1 }).pass).toBe(true);
  });

  it('fails each metric independently with a named reason', () => {
    expect(checkVitals({ lcpMs: 2501, inpMs: 120, cls: 0.05 }).failures).toEqual([
      'lcp 2501ms > 2500ms',
    ]);
    expect(checkVitals({ lcpMs: 1800, inpMs: 201, cls: 0.05 }).failures).toEqual([
      'inp 201ms > 200ms',
    ]);
    expect(checkVitals({ lcpMs: 1800, inpMs: 120, cls: 0.11 }).failures).toEqual([
      'cls 0.11 > 0.1',
    ]);
  });

  it('never reports a missing INP as a pass (no TBT substitution, no fake zero)', () => {
    for (const inpMs of [null, undefined, Number.NaN]) {
      const res = checkVitals({ lcpMs: 1800, inpMs, cls: 0.05 });
      expect(res.pass, String(inpMs)).toBe(false);
      expect(res.failures.some((f) => f.startsWith('inp-missing'))).toBe(true);
    }
  });

  it('summarizes runs with the pre-specified median', () => {
    expect(summarizeRuns([3, 1, 2])).toBe(2);
    expect(summarizeRuns([4, 1, 3, 2])).toBe(2.5);
    expect(summarizeRuns([5])).toBe(5);
    expect(() => summarizeRuns([])).toThrow(/empty sample/);
    expect(() => summarizeRuns([Number.NaN])).toThrow(/empty sample/);
  });
});

describe('#90 — the three gate files cannot drift apart', () => {
  it('lighthouserc.cjs reads the budgets module (no copied numbers)', () => {
    const config = read('lighthouserc.cjs');
    for (const symbol of [
      'BUDGETS.performanceScore',
      'BUDGETS.lcpMs',
      'BUDGETS.cls',
      'BUDGETS.runs',
      'PROFILE.rttMs',
      'PROFILE.throughputKbps',
      'PROFILE.cpuThrottlingRate',
    ]) {
      expect(config, symbol).toContain(symbol);
    }
    for (const url of VITAL_URLS) expect(config).toContain('VITAL_URLS');
    expect(config).toContain('node scripts/e2e-server.mjs');
    expect(config).toContain(`target: 'filesystem'`);
    expect(config).toContain('lhci-artifacts');
    // Navigation-mode Lighthouse must NOT assert INP — the Playwright flow owns it.
    expect(config).not.toMatch(/interaction-to-next-paint/);
    expect(config).not.toContain(`'inp'`);
    expect(config).toContain('numberOfRuns');
  });

  it('the Playwright spec carries the identical budgets/profile/urls', () => {
    const spec = read('e2e/web-vitals.spec.ts');
    expect(spec).toContain(`LCP_MS = ${BUDGETS.lcpMs}`);
    expect(spec).toContain(`INP_MS = ${BUDGETS.inpMs}`);
    expect(spec).toContain(`CLS = ${BUDGETS.cls}`);
    expect(spec).toContain(`RUNS = ${BUDGETS.runs}`);
    expect(spec).toContain(`CPU_THROTTLING_RATE = ${PROFILE.cpuThrottlingRate}`);
    expect(spec).toContain(`downloadThroughput: ${PROFILE.throughputKbps} * 1024`);
    expect(spec).toContain(`latency: ${PROFILE.latencyMs}`);
    for (const url of VITAL_URLS) {
      expect(spec).toContain(new URL(url).pathname);
    }
    // No fake INP anywhere: missing timing is an explicit failure.
    expect(spec).toContain('inp-missing (no interaction timing observed — not a pass)');
    expect(spec).toContain('no-real-interaction');
  });

  it('wires the scoped npm script', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['web-vitals']).toBe('playwright test e2e/web-vitals.spec.ts');
  });
});
