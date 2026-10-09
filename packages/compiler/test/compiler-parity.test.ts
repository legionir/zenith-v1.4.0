// #27: @zenith/compiler parity framework — runParityTest / runAllParityTests /
// generateParityReport must behave deterministically given injected runners.
import { describe, it, expect } from 'vitest';
import {
  runParityTest,
  runAllParityTests,
  generateParityReport,
  STANDARD_TEST_SUITES,
  CORE_DIRECTIVES,
  type ParityTestContext,
} from '@zenith/compiler';

describe('CORE_DIRECTIVES / STANDARD_TEST_SUITES', () => {
  it('lists the well-known directives and suites reference them', () => {
    expect(CORE_DIRECTIVES).toContain('zen-text');
    expect(CORE_DIRECTIVES).toContain('zen-for');
    expect(STANDARD_TEST_SUITES.length).toBeGreaterThan(0);
    const dirs = new Set(STANDARD_TEST_SUITES.map((s) => s.directive));
    for (const d of dirs) {
      expect((CORE_DIRECTIVES as readonly string[]).includes(d)).toBe(true);
    }
  });
});

describe('runParityTest', () => {
  it('marks cases as matching when normalized outputs are equal', () => {
    const suite = {
      name: 'x',
      directive: 'zen-text',
      cases: [{ state: { a: 1 }, html: '<div zen-text="a"></div>' }],
    };
    // Leading/trailing + inter-tag whitespace is normalized away → match.
    const rt = (_: ParityTestContext) => '  <div>a</div>\n ';
    const cp = (_: ParityTestContext) => '<div>a</div>';
    const results = runParityTest(suite, rt, cp);
    expect(results).toHaveLength(1);
    expect(results[0]!.match).toBe(true);
  });

  it('marks mismatches with details', () => {
    const suite = STANDARD_TEST_SUITES[0]!;
    const results = runParityTest(
      suite,
      () => 'AAA',
      () => 'BBB',
    );
    for (const r of results) {
      expect(r.match).toBe(false);
      expect(r.details).toBeTruthy();
    }
  });
});

describe('runAllParityTests + report', () => {
  it('aggregates all suites and counts total/passed/failed', () => {
    const sameRunner = (c: ParityTestContext) => c.html;
    const report = runAllParityTests(sameRunner, sameRunner);
    expect(report.total).toBe(
      STANDARD_TEST_SUITES.reduce((n, s) => n + s.cases.length, 0),
    );
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
  });

  it('generateParityReport renders a summary with status line', () => {
    const report = runAllParityTests(() => 'a', () => 'b');
    const text = generateParityReport(report);
    expect(text).toContain('PARITY REPORT');
    expect(text).toContain('Total tests');
    expect(text).toMatch(/PARITY MISMATCHES DETECTED/);
  });

  it('generateParityReport shows ALL PASSED when no mismatches', () => {
    const r = (c: ParityTestContext) => c.html;
    const report = runAllParityTests(r, r);
    expect(generateParityReport(report)).toMatch(/ALL PARITY CHECKS PASSED/);
  });
});
