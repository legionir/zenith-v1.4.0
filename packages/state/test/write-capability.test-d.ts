import { expectTypeOf } from 'vitest';
import { signal, isWritable, type WritableCapability, type EffectContext, type EffectSubscriber, type Signal } from '../src';
declare const external: unknown;
if (isWritable(external)) {
  expectTypeOf(external).toEqualTypeOf<WritableCapability>();
  // @ts-expect-error A setter-only observation does not prove any readable value.
  external.get();
  // @ts-expect-error The unknown setter's accepted domain has not been validated.
  external.set('unvalidated');
}
const count = signal(1);
if (isWritable(count)) {
  count.set(2);
  // @ts-expect-error Existing Signal<number> still requires numeric writes.
  count.set('2');
}
expectTypeOf<Parameters<Signal<number>['removeSubscriber']>[0]>().toEqualTypeOf<EffectSubscriber>();
expectTypeOf<EffectContext['activeEffect']>().toEqualTypeOf<EffectSubscriber | null>();
// @ts-expect-error Subscribers are actually scheduled without arguments.
const requiresPayload: EffectSubscriber = (_payload: number) => {};
void requiresPayload;
