import { expectTypeOf } from 'vitest';
import { effect, type EffectSubscriber, type Owner } from '@zenith/state';
import {
  setEffectContextStore, getEffectPriority, isGlobalObservationEnabled, type EffectContext,
} from '@zenith/state/internal';

const owner: Owner = { children: new Set(), cleanup: new Set(), disposed: false };
const host: EffectContext = {
  owner, activeEffect: null, activeCleanupRegistration: null,
  bind: callback => (...args) => callback(...args),
};
expectTypeOf(host.activeEffect).toEqualTypeOf<EffectSubscriber | null>();
const bind = host.bind;
if (bind) {
  const value = { id: Symbol('actual') };
  expectTypeOf(bind(() => value)()).toEqualTypeOf<typeof value>();
  expectTypeOf(bind(async () => value)()).toEqualTypeOf<Promise<typeof value>>();
  const ordered = bind((id: string, count: number) => ({ id, count }));
  expectTypeOf(ordered).toEqualTypeOf<(id: string, count: number) => { id: string; count: number }>();
  // @ts-expect-error Host binding preserves actual parameter order.
  ordered(1, 'wrong');
}
setEffectContextStore(() => host);
expectTypeOf(isGlobalObservationEnabled()).toEqualTypeOf<boolean>();
expectTypeOf(getEffectPriority(() => {})).toEqualTypeOf<import('@zenith/state').Priority>();
const dispose: () => void = effect(() => {}, { owner });
dispose(); setEffectContextStore(null);
