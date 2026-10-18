// @vitest-environment jsdom
import { expectTypeOf, it } from 'vitest';
import { createApp, definePlugin, type BindContext, type AppOptions } from '../src';
import { createResource } from '@zenith/resource';
import { defineStore } from '@zenith/store';
it('keeps unknown-valued extension boundaries and preserves explicit Store/Resource inference', () => {
  expectTypeOf<BindContext['state']>().toEqualTypeOf<Record<string, unknown>>();
  expectTypeOf<NonNullable<AppOptions['state']>>().toEqualTypeOf<Record<string, unknown>>();
  const plugin = definePlugin({ name: 'typed', install(_app, options?: { title: string }) { void options?.title; } });
  const app = createApp(); app.use(plugin, { title: 'typed' });
  const use = defineStore('types', { state: () => ({ count: 1 }), getters: { double: (state: { count: number }) => state.count * 2 }, actions: { add(value: number) { return value + 1; } } });
  const store = app.run(use); expectTypeOf(store.double.get()).toEqualTypeOf<number>(); expectTypeOf(store.add(1)).toEqualTypeOf<number>();
  const resource = app.run(() => createResource<{ id: number }>('typed-resource', { url: '/api' })); expectTypeOf(resource.data).toEqualTypeOf<{ id: number } | null>(); app.dispose();
});
it('does not infer arbitrary actions/getters when those definitions are absent', () => {
  const use = defineStore('without-extensions', { state: () => ({ count: 1 }) });
  type Value = ReturnType<typeof use>;
  expectTypeOf<'missingAction' extends keyof Value ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<Value['dispose']>().toEqualTypeOf<() => void>();
});
