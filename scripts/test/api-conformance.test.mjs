// @vitest-environment jsdom
/* global document */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAction,
  getAction,
  hasAction,
  listActions,
  unregisterAction,
  clearActions,
} from '../../packages/actions/src/index.ts';
import {
  registerComponent,
  getComponent,
  hasComponent,
  listComponents,
  unregisterComponent,
  clearComponents,
} from '../../packages/components/src/index.ts';
import {
  Resource,
  registerResource,
  getResource,
  hasResource,
  listResources,
  unregisterResource,
  clearResources,
} from '../../packages/resource/src/index.ts';
import {
  defineStore,
  registerStore,
  getStore,
  hasStore,
  listStores,
  unregisterStore,
  clearStores,
} from '../../packages/store/src/index.ts';
import {
  registerServerComponent,
  getServerComponent,
  hasServerComponent,
  listServerComponents,
  unregisterServerComponent,
  clearServerComponents,
} from '../../packages/ssr/src/index.ts';
import { clearHttpCache, httpRequest } from '../../packages/http/src/index.ts';
import { clearExpressionCache } from '../../packages/expressions/src/index.ts';
import { showAlert, showConfirm } from '../../packages/notifications/src/index.ts';
import { scheduleEffect } from '../../packages/scheduler/src/index.ts';
import { registerTestingReset, resetForTesting } from '../../packages/testing/src/index.ts';
import {
  createApp,
  defineDirective,
  onMount,
  onUnmount,
  onUpdate,
  provide,
  inject,
  createInjectionKey,
} from '../../packages/runtime-core/src/index.ts';
import { parseConfigAttr, s } from '../../packages/schema/src/index.ts';
import {
  createAuth,
  registerAuth,
  getAuth,
  hasAuth,
  listAuths,
  unregisterAuth,
} from '../../packages/auth/src/index.ts';
import {
  registerPermissionManager,
  getPermissionManager,
  hasPermissionManager,
  listPermissionManagers,
  unregisterPermissionManager,
  createPermissionManager,
} from '../../packages/permission/src/index.ts';
import {
  registerEventModifier,
  getEventModifier,
  hasEventModifier,
} from '../../packages/events/src/index.ts';
import {
  registerCustomDirective,
  getCustomDirective,
  hasCustomDirective,
  unregisterCustomDirective,
} from '../../packages/runtime/src/index.ts';
import {
  registerDevtoolsCache,
  getRegisteredCaches,
  registerDevtoolsStore,
  getRegisteredStores,
} from '../../packages/devtools-core/src/index.ts';
import {
  defineRule,
  defineAsyncRule,
  getRule,
  hasRule,
  listRules,
  unregisterRule,
  getAsyncRule,
  hasAsyncRule,
  listAsyncRules,
  unregisterAsyncRule,
} from '../../packages/form/src/index.ts';
import {
  registerCache,
  getCache,
  hasCache,
  unregisterCache,
} from '../../packages/cache/src/index.ts';
import { onGlobalReset, runGlobalResets } from '../../packages/errors/src/index.ts';

describe('Wave 4 P1 Batch 8 — Registry Uniformity, Unambiguous Exports, Directives, Lifecycle & DI (#118..#125)', () => {
  beforeEach(() => {
    clearActions();
    clearComponents();
    clearResources();
    clearStores();
    clearServerComponents();
  });

  it('enforces the uniform 5-method registry contract (registerX -> Cleanup, getX, hasX, listXs, unregisterX) (#118, #121)', () => {
    // 1. @zenith/actions
    const stopAct = registerAction('save', () => 'ok');
    expect(hasAction('save')).toBe(true);
    expect(typeof getAction('save')).toBe('function');
    expect(listActions().some((a) => a.name === 'save')).toBe(true);
    stopAct();
    stopAct(); // idempotent cleanup
    expect(hasAction('save')).toBe(false);

    registerAction('del', () => 'deleted');
    expect(unregisterAction('del')).toBe(true);
    expect(unregisterAction('del')).toBe(false);

    // 2. @zenith/components
    const tpl = document.createElement('template');
    const stopComp = registerComponent('x-card', tpl);
    expect(hasComponent('x-card')).toBe(true);
    expect(getComponent('x-card')).toBe(tpl);
    expect(listComponents()).toContain('x-card');
    stopComp();
    stopComp(); // idempotent cleanup
    expect(hasComponent('x-card')).toBe(false);

    registerComponent('x-badge', tpl);
    expect(unregisterComponent('x-badge')).toBe(true);
    expect(unregisterComponent('x-badge')).toBe(false);

    // 3. @zenith/resource
    const res = new Resource({ url: '/api/items' });
    const stopRes = registerResource('items', res);
    expect(hasResource('items')).toBe(true);
    expect(getResource('items')).toBe(res);
    expect(listResources()).toContain('items');
    stopRes();
    stopRes(); // idempotent
    expect(hasResource('items')).toBe(false);

    registerResource('posts', res);
    expect(unregisterResource('posts')).toBe(true);
    expect(unregisterResource('posts')).toBe(false);

    // 4. @zenith/store
    const useCounter = defineStore('counter', {
      state: () => ({ n: 0 }),
    });
    const storeInstance = useCounter();
    expect(hasStore('counter')).toBe(true);
    expect(getStore('counter')).toBe(storeInstance);
    expect(listStores()).toContain('counter');
    expect(unregisterStore('counter')).toBe(true);
    expect(hasStore('counter')).toBe(false);

    const stopStore = registerStore('manual-store', storeInstance);
    expect(hasStore('manual-store')).toBe(true);
    stopStore();
    stopStore();
    expect(hasStore('manual-store')).toBe(false);

    // 5. @zenith/ssr
    const stopSrv = registerServerComponent({
      name: 'srv-box',
      render: () => '<div>srv</div>',
    });
    expect(hasServerComponent('srv-box')).toBe(true);
    expect(getServerComponent('srv-box')?.name).toBe('srv-box');
    expect(listServerComponents()).toContain('srv-box');
    stopSrv();
    stopSrv();
    expect(hasServerComponent('srv-box')).toBe(false);

    registerServerComponent({ name: 'srv-two', render: () => '<p>2</p>' });
    expect(unregisterServerComponent('srv-two')).toBe(true);

    // 6. resetForTesting() hook in @zenith/testing
    let customResetCalled = 0;
    const unregHook = registerTestingReset(() => {
      customResetCalled++;
    });
    resetForTesting();
    expect(customResetCalled).toBe(1);
    unregHook();
  });

  it('covers every remaining registry with the same 5-method contract (#118)', () => {
    // @zenith/auth — کلید پیش‌فرض 'default'
    const fakeAuth = createAuth({ loginUrl: '/login', tokenStorage: 'memory' });
    const stopAuth = registerAuth('app', fakeAuth);
    expect(hasAuth('app')).toBe(true);
    expect(getAuth('app')).toBe(fakeAuth);
    expect(listAuths()).toContain('app');
    stopAuth();
    stopAuth();
    expect(hasAuth('app')).toBe(false);
    registerAuth('app2', fakeAuth);
    expect(unregisterAuth('app2')).toBe(true);
    expect(unregisterAuth('app2')).toBe(false);

    // @zenith/permission
    const manager = createPermissionManager();
    const stopPerm = registerPermissionManager('app', manager);
    expect(hasPermissionManager('app')).toBe(true);
    expect(getPermissionManager('app')).toBe(manager);
    expect(listPermissionManagers()).toContain('app');
    stopPerm();
    stopPerm();
    expect(hasPermissionManager('app')).toBe(false);
    registerPermissionManager('app2', manager);
    expect(unregisterPermissionManager('app2')).toBe(true);

    // @zenith/events (modifier)
    const mod = () => undefined;
    const stopMod = registerEventModifier('mymod', mod);
    expect(hasEventModifier('mymod')).toBe(true);
    expect(getEventModifier('mymod')).toBe(mod);
    stopMod();

    // @zenith/runtime (custom directive)
    const handler = () => undefined;
    const stopDir = registerCustomDirective('zen-x', handler);
    expect(hasCustomDirective('zen-x')).toBe(true);
    expect(getCustomDirective('zen-x')).toBeTruthy();
    stopDir();
    registerCustomDirective('zen-y', handler);
    expect(unregisterCustomDirective('zen-y')).toBe(true);

    // @zenith/devtools-core (panel registries)
    const stopCacheReg = registerDevtoolsCache('c1', {});
    expect(getRegisteredCaches().get('c1')).toEqual({});
    stopCacheReg();
    expect(getRegisteredCaches().has('c1')).toBe(false);
    const stopStoreReg = registerDevtoolsStore('s1', {});
    expect(getRegisteredStores().get('s1')).toEqual({});
    stopStoreReg();
    expect(getRegisteredStores().has('s1')).toBe(false);
  });

  it('covers form validation rules and the cache name registry with the same 5-method contract (#118)', () => {
    // @zenith/form — sync rules
    const stopSync = defineRule('t-required', () => ({ valid: true, error: null }));
    expect(hasRule('t-required')).toBe(true);
    expect(typeof getRule('t-required')).toBe('function');
    expect(listRules()).toContain('t-required');
    stopSync();
    stopSync(); // idempotent cleanup
    expect(hasRule('t-required')).toBe(false);

    defineRule('t-dup', () => ({ valid: true, error: null }));
    expect(unregisterRule('t-dup')).toBe(true);
    expect(unregisterRule('t-dup')).toBe(false);

    // @zenith/form — async rules live in a separate namespace
    const stopAsync = defineAsyncRule('t-unique', () =>
      Promise.resolve({ valid: true, error: null }),
    );
    expect(hasAsyncRule('t-unique')).toBe(true);
    expect(hasRule('t-unique')).toBe(false);
    expect(listAsyncRules()).toContain('t-unique');
    stopAsync();
    expect(hasAsyncRule('t-unique')).toBe(false);
    defineAsyncRule('t-a2', () => Promise.resolve({ valid: true, error: null }));
    expect(unregisterAsyncRule('t-a2')).toBe(true);
    expect(unregisterAsyncRule('t-a2')).toBe(false);

    // @zenith/cache — name registry for devtools (complements listCaches)
    const fakeCache = { stats: () => ({ size: 0 }) };
    const stopCache = registerCache('t-cache', fakeCache);
    expect(hasCache('t-cache')).toBe(true);
    expect(getCache('t-cache')).toBe(fakeCache);
    stopCache();
    stopCache(); // idempotent
    expect(hasCache('t-cache')).toBe(false);

    registerCache('t-cache2', fakeCache);
    expect(unregisterCache('t-cache2')).toBe(true);
    expect(unregisterCache('t-cache2')).toBe(false);
  });

  it('resetForTesting() clears every global registry — no cross-test leaks (#118)', () => {
    // #118: هر پکیج دارندهٔ وضعیت سراسری یک هوک ثبت کرده است.
    expect(runGlobalResets()).toBeGreaterThanOrEqual(12);

    registerAction('leak-action', () => 'x');
    const tpl = document.createElement('template');
    registerComponent('leak-comp', tpl);
    registerResource('leak-res', new Resource({ url: '/api/x' }));
    registerServerComponent({ name: 'leak-srv', render: () => '<i/>' });
    registerDevtoolsCache('leak-cache', {});
    registerEventModifier('leak-mod', () => undefined);
    registerCustomDirective('zen-leak', () => undefined);
    registerAuth('leak-auth', createAuth({ loginUrl: '/login', tokenStorage: 'memory' }));
    registerPermissionManager('leak-perm', createPermissionManager());
    defineRule('leak-rule', () => ({ valid: true, error: null }));
    defineAsyncRule('leak-arule', () => Promise.resolve({ valid: true, error: null }));
    registerCache('leak-cache2', { stats: () => ({ size: 0 }) });

    expect(hasAction('leak-action')).toBe(true);
    expect(hasComponent('leak-comp')).toBe(true);
    expect(hasResource('leak-res')).toBe(true);
    expect(hasServerComponent('leak-srv')).toBe(true);
    expect(getRegisteredCaches().has('leak-cache')).toBe(true);
    expect(hasEventModifier('leak-mod')).toBe(true);
    expect(hasCustomDirective('zen-leak')).toBe(true);
    expect(hasAuth('leak-auth')).toBe(true);
    expect(hasPermissionManager('leak-perm')).toBe(true);
    expect(hasRule('leak-rule')).toBe(true);
    expect(hasAsyncRule('leak-arule')).toBe(true);
    expect(hasCache('leak-cache2')).toBe(true);

    resetForTesting();

    expect(hasAction('leak-action')).toBe(false);
    expect(hasComponent('leak-comp')).toBe(false);
    expect(hasResource('leak-res')).toBe(false);
    expect(hasServerComponent('leak-srv')).toBe(false);
    expect(getRegisteredCaches().has('leak-cache')).toBe(false);
    expect(hasEventModifier('leak-mod')).toBe(false);
    expect(hasCustomDirective('zen-leak')).toBe(false);
    expect(hasAuth('leak-auth')).toBe(false);
    expect(hasPermissionManager('leak-perm')).toBe(false);
    expect(hasRule('leak-rule')).toBe(false);
    expect(hasAsyncRule('leak-arule')).toBe(false);
    expect(hasCache('leak-cache2')).toBe(false);
  });

  it('runGlobalResets() keeps going when a hook throws and reports how many ran (#118)', () => {
    const bad = onGlobalReset(() => {
      throw new Error('boom');
    });
    const before = runGlobalResets();
    const after = runGlobalResets();
    expect(after).toBe(before); // هوک خراب هرگز شمرده نمی‌شود
    bad();
    expect(runGlobalResets()).toBe(after); // پس از حذف هوک خراب، همهٔ ۱۲ هوک سالم اجرا می‌شوند
    expect(after).toBeGreaterThanOrEqual(12);
  });

  it('exports unambiguous public API names across packages (#119)', () => {
    expect(typeof clearHttpCache).toBe('function');
    expect(typeof httpRequest).toBe('function');
    expect(typeof clearExpressionCache).toBe('function');
    expect(typeof showAlert).toBe('function');
    expect(typeof showConfirm).toBe('function');
    expect(typeof scheduleEffect).toBe('function');
  });

  it('validates directive attributes via shared parseConfigAttr and supports lifecycle + provide/inject (#120, #124, #125)', () => {
    const el = document.createElement('div');
    el.setAttribute('data-cfg', '{"delay":150}');
    const cfg = parseConfigAttr(el, 'data-cfg', s.object({ delay: s.number() }), 'zen-test');
    expect(cfg).toEqual({ delay: 150 });

    const ThemeKey = createInjectionKey('theme');
    const events = [];
    let injectedTheme;

    const host = document.createElement('div');
    host.innerHTML = '<div zen-lifecycle-probe="1"></div>';
    document.body.appendChild(host);

    const app = createApp({ state: { count: 1 } });
    app.provide(ThemeKey, 'persian-blue');
    app.directive(
      defineDirective({
        name: 'lifecycle-probe',
        bind() {
          provide(ThemeKey, 'scoped-gold');
          injectedTheme = inject(ThemeKey);
          onMount(() => {
            events.push('mount');
            return () => {
              events.push('mount-cleanup');
            };
          });
          onUpdate(() => {
            events.push('update');
          });
          onUnmount(() => {
            events.push('unmount');
          });
          return () => {};
        },
      }),
    );
    app.mount(host);

    expect(injectedTheme).toBe('scoped-gold');
    expect(events).toContain('mount');

    app.unmount();
    expect(events).toContain('mount-cleanup');
    expect(events).toContain('unmount');
    host.remove();
  });
});
