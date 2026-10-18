import { expectTypeOf } from 'vitest';
import { runParityTest, runAllParityTests, type ParityTestContext, type ParityRunnerOptions, type ParityReport } from '../src';
declare const context: ParityTestContext;
expectTypeOf(context.state.value).toEqualTypeOf<unknown>();
// @ts-expect-error A dynamic state value requires narrowing.
context.state.value.toUpperCase();
const options: ParityRunnerOptions = { runtimeRunner: ctx => ctx.html, compilerRunner: ctx => ctx.html };
expectTypeOf(runAllParityTests(options)).toEqualTypeOf<ParityReport>();
runParityTest({ name: 'typed', directive: 'zen-text', cases: [context] }, options);
