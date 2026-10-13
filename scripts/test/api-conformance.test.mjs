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
