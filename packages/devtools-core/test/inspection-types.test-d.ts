import { expectTypeOf } from 'vitest';
import { signal } from '@zenith/state';
import { registerSignal, type UntypedSignal } from '../src';
const value = signal('specific');
const view: UntypedSignal = value;
expectTypeOf(view.get()).toEqualTypeOf<unknown>();
expectTypeOf(registerSignal(value)).toEqualTypeOf<string>();
// @ts-expect-error Inspection must not expose a broadly writable Signal<unknown>.
view.set({ unchecked: 'payload' });
value.set('still specific');
// @ts-expect-error Registration must not erase the original value contract.
value.set(2);

const readonly: import('@zenith/state').ReadonlySignal<number> = signal(1);
expectTypeOf(registerSignal<number>(readonly)).toEqualTypeOf<string>();
const readable = { get: () => ({ id: 'opaque' }) };
expectTypeOf(registerSignal(readable)).toEqualTypeOf<string>();
const typedView: UntypedSignal<{ id: string }> = readable;
expectTypeOf(typedView.get()).toEqualTypeOf<{ id: string }>();
// @ts-expect-error Inspector generic arguments must match the actual readable domain.
registerSignal<number>(readable);
