import { afterEach, expect, it } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
import { runParityTest, runAllParityTests, type ParityTestSuite, type ParityTestContext } from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); resetDeprecationWarnings(); });
const suite: ParityTestSuite = { name: 'identity', directive: 'zen-text', cases: [{ state: { value: { count: 1 } }, html: '<p>text</p>' }] };
it('uses canonical runner bags without emitting a bridge warning or replacing case/state identity', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const seen: ParityTestContext[] = [];
  const runtimeRunner = (ctx: ParityTestContext) => { seen.push(ctx); return ` ${ctx.html} `; };
  const compilerRunner = (ctx: ParityTestContext) => { seen.push(ctx); return ctx.html; };
  expect(runParityTest(suite, { runtimeRunner, compilerRunner })[0]?.match).toBe(true);
  expect(seen).toEqual([suite.cases[0], suite.cases[0]]);
  expect(seen[0]).toBe(suite.cases[0]); expect(seen[0]?.state).toBe(suite.cases[0]?.state);
  expect(runAllParityTests({ runtimeRunner, compilerRunner }).failed).toBe(0);
  expect(messages.some(message => /ZEN-DEPR-09[01]/.test(message))).toBe(false);
});
it('warns once for each retained bridge and preserves report equivalence', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const runtimeRunner = (ctx: ParityTestContext) => ctx.html, compilerRunner = () => '<i>different</i>';
  const expected = runParityTest(suite, { runtimeRunner, compilerRunner });
  expect(runParityTest(suite, runtimeRunner, compilerRunner)).toEqual(expected);
  expect(runParityTest(suite, runtimeRunner, compilerRunner)).toEqual(expected);
  expect(runAllParityTests(runtimeRunner, compilerRunner)).toEqual(runAllParityTests({ runtimeRunner, compilerRunner }));
  runAllParityTests(runtimeRunner, compilerRunner);
  expect(messages.filter(message => message.includes('ZEN-DEPR-090'))).toHaveLength(1);
  expect(messages.filter(message => message.includes('ZEN-DEPR-091'))).toHaveLength(1);
});
it('validates canonical callback capabilities but does not intercept legacy callback exceptions', () => {
  // @ts-expect-error Runtime caller supplied a non-callable runner.
  expect(() => runParityTest(suite, { runtimeRunner: true, compilerRunner: () => '' })).toThrow();
  // @ts-expect-error Both canonical callbacks are required.
  expect(() => runAllParityTests({ runtimeRunner: () => '' })).toThrow();
  const failure = new Error('native callback');
  expect(() => runParityTest(suite, () => { throw failure; }, () => '')).toThrow(failure);
});
