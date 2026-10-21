// #86 — tests for the ≤5% reference runner. The verdict logic is pure, so the
// gate itself (pass/fail/self-check-trip) is provable WITHOUT running any
// bench — real multi-pass execution stays in validation (needs dist builds +
// the reference machine).
import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_MISMATCH_EXIT,
  REFERENCE_ENV_FIELDS,
  REFERENCE_RUNS,
  REFERENCE_TOLERANCE_PCT,
  checkReferenceEnvironment,
  evaluateReferenceRuns,
  injectDeviation,
  parseReferenceArgs,
} from '../bench-reference.mjs';

const BASELINE_METRICS = {
  'reactive.zenith.signal-read': { id: 'reactive.zenith.signal-read', value: 100, gate: true },
  'dom.select-1k': { id: 'dom.select-1k', value: 10, unit: 'ms', gate: true },
  'reactive.zenith.noisy': { id: 'reactive.zenith.noisy', value: 1000, gate: false },
};

const cleanRun = () => [
  { id: 'reactive.zenith.signal-read', value: 102, unit: 'ops/sec' },
  { id: 'dom.select-1k', value: 10.3, unit: 'ms' },
  { id: 'reactive.zenith.noisy', value: 5000, unit: 'ops/sec' },
];

describe('#86 — reference runner CLI contract', () => {
  it('defaults to the predefined 5-run plan', () => {
    expect(parseReferenceArgs([])).toEqual({
      runs: 5,
      only: null,
      outDir: null,
      selfCheck: false,
    });
    expect(REFERENCE_RUNS).toBe(5);
    expect(REFERENCE_TOLERANCE_PCT).toBe(5);
    expect(ENVIRONMENT_MISMATCH_EXIT).toBe(2);
  });

  it('rejects fewer than 5 runs: the evidence floor is not negotiable per-run', () => {
    expect(() => parseReferenceArgs(['--runs', '4'])).toThrow(/≥ ۵/);
    expect(() => parseReferenceArgs(['--runs', '0'])).toThrow(/≥ ۵/);
    expect(() => parseReferenceArgs(['--runs', 'abc'])).toThrow(/≥ ۵/);
    expect(parseReferenceArgs(['--runs', '7']).runs).toBe(7);
  });

  it('parses --only/--out-dir/--self-check and rejects unknown flags', () => {
    expect(parseReferenceArgs(['--only', 'a,b']).only).toEqual(['a', 'b']);
    expect(parseReferenceArgs(['--only', '']).only).toBeNull();
    expect(parseReferenceArgs(['--out-dir', 'x']).outDir).toBe('x');
    expect(parseReferenceArgs(['--self-check']).selfCheck).toBe(true);
    expect(parseReferenceArgs(['--', '--self-check']).selfCheck).toBe(true);
    expect(() => parseReferenceArgs(['--bogus'])).toThrow(/پرچم ناشناخته/);
  });
});

describe('#86 — fail-closed environment check', () => {
  const live = {
    node: 'v22.22.3',
    v8: '12.4',
    platform: 'linux x64',
    cpuModel: 'Xeon',
    cpuCores: 2,
    domEngine: 'jsdom@24.1.3',
  };

  it('accepts the identical machine', () => {
    expect(checkReferenceEnvironment(live, { ...live })).toEqual({ ok: true, mismatches: [] });
    expect(REFERENCE_ENV_FIELDS).toContain('domEngine');
  });

  it('names every drifted field instead of silently downgrading', () => {
    const res = checkReferenceEnvironment(live, { ...live, node: 'v20.0.0', cpuCores: 8 });
    expect(res.ok).toBe(false);
    expect(res.mismatches).toHaveLength(2);
    expect(res.mismatches.join(' ')).toContain('node');
    expect(res.mismatches.join(' ')).toContain('cpuCores');
  });

  it('refuses a baseline with no recorded environment', () => {
    expect(checkReferenceEnvironment(live, null).ok).toBe(false);
    expect(checkReferenceEnvironment(live, undefined).ok).toBe(false);
  });
});

describe('#86 — the ≤5% verdict over predefined runs', () => {
  it('passes when every gated metric is within 5% in every run', () => {
    const verdict = evaluateReferenceRuns(
      [cleanRun(), cleanRun(), cleanRun(), cleanRun(), cleanRun()],
      BASELINE_METRICS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.checked).toBe(2);
    expect(verdict.runs).toBe(5);
    expect(verdict.informational).toBe(1);
    expect(verdict.failures).toEqual([]);
  });

  it('uses absolute deviation: a 6% speedup fails like a 6% slowdown', () => {
    const runs = [cleanRun()];
    runs[0] = injectDeviation(runs[0], 'reactive.zenith.signal-read', 1.06);
    const verdict = evaluateReferenceRuns(runs, BASELINE_METRICS);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toHaveLength(1);
    expect(verdict.failures[0]).toMatchObject({ id: 'reactive.zenith.signal-read', runIndex: 0 });
    // جهت ms هم قدرمطلق است: ۱۰٪ سریع‌تر شدنِ زمان، بازتولید نیست.
    const fast = [injectDeviation(cleanRun(), 'dom.select-1k', 0.9)];
    expect(evaluateReferenceRuns(fast, BASELINE_METRICS).pass).toBe(false);
  });

  it('fails when ONE run out of five drifts (no best-run cherry-picking)', () => {
    const runs = [cleanRun(), cleanRun(), cleanRun(), cleanRun(), cleanRun()];
    runs[3] = injectDeviation(runs[3], 'dom.select-1k', 1.2);
    const verdict = evaluateReferenceRuns(runs, BASELINE_METRICS);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toHaveLength(1);
    expect(verdict.failures[0]).toMatchObject({ id: 'dom.select-1k', runIndex: 3 });
  });

  it('is fail-closed on a gated metric missing from any run', () => {
    const runs = [cleanRun()];
    runs[0] = runs[0].filter((m) => m.id !== 'dom.select-1k');
    const verdict = evaluateReferenceRuns(runs, BASELINE_METRICS);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures[0]).toMatchObject({ id: 'dom.select-1k', reason: 'missing-in-run' });
  });

  it('excludes informational metrics from the verdict but counts them', () => {
    // noisy ×۵ هم باز سبز است: ادعایی برایش نیست.
    const runs = [injectDeviation(cleanRun(), 'reactive.zenith.noisy', 5)];
    const verdict = evaluateReferenceRuns(runs, BASELINE_METRICS);
    expect(verdict.pass).toBe(true);
    expect(verdict.informational).toBe(1);
  });

  it('fails with zero runs and ignores unknown ids', () => {
    expect(evaluateReferenceRuns([], BASELINE_METRICS).pass).toBe(false);
    const runs = [[...cleanRun(), { id: 'unknown.metric', value: -1, unit: 'x' }]];
    expect(evaluateReferenceRuns(runs, BASELINE_METRICS).pass).toBe(true);
  });

  it('injectDeviation copies without mutating the input', () => {
    const run = cleanRun();
    const out = injectDeviation(run, 'dom.select-1k', 2);
    expect(out.find((m) => m.id === 'dom.select-1k').value).toBe(run.find((m) => m.id === 'dom.select-1k').value * 2);
    expect(run.find((m) => m.id === 'dom.select-1k').value).toBe(10.3);
  });
});
