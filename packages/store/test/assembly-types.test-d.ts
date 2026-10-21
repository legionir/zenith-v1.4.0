import { expectTypeOf } from 'vitest';
import { defineStore } from '../src';
const store = defineStore('typed-assembly', { state: () => ({ count: 1 }), getters: { double: (state: { count: number }) => state.count * 2 }, actions: { add(amount: number) { this.state.count += amount; return this.state.count; } } })();
expectTypeOf(store.double.get()).toEqualTypeOf<number>(); expectTypeOf(store.add(2)).toEqualTypeOf<number>();
// @ts-expect-error Dynamic assembly must not erase action arguments.
store.add('bad');
// @ts-expect-error State keeps the caller's known value type.
store.state.count = 'bad';
store.$onAction(context => { expectTypeOf(context.args).toEqualTypeOf<unknown[]>(); context.after(result => { expectTypeOf(result).toBeUnknown(); }); });
