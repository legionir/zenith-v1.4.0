import { expectTypeOf } from 'vitest';
import { createMockResource, createMockSignal, render, testDirective, type TestHarness, type FakeTimersController } from '../src';
expectTypeOf(createMockSignal({ id: 1 }).signal.get()).toEqualTypeOf<{ id: number }>();
expectTypeOf(createMockResource({ id: 1 }).data.get()).toEqualTypeOf<{ id: number } | null>();
declare const harness: TestHarness & Disposable;
expectTypeOf(harness[Symbol.dispose]).toBeFunction();
declare const clock: FakeTimersController;
expectTypeOf(clock.now()).toEqualTypeOf<number>();
// @ts-expect-error A fake clock controller does not advertise Node Timeout capabilities.
clock.unref();
const result = render({ template: '<p></p>', state: { payload: { value: 1 } } });
expectTypeOf(result.query<HTMLParagraphElement>('p')).toEqualTypeOf<HTMLParagraphElement | null>();
testDirective({ name: 'typed', bind(_el, ctx) { expectTypeOf(ctx.state.answer).toEqualTypeOf<number>(); expectTypeOf(ctx.eval()).toEqualTypeOf<unknown>(); } }, { html: '<div zen-typed></div>', state: { answer: 42 } });
