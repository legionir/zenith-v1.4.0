// @vitest-environment jsdom
// #148 — تست‌های جامع @zenith/runtime-core (SPEC §۲.۸):
//   • دو نمونهٔ createApp هم‌زمان در یک صفحه بدون نشت state/directive/plugin
//   • اولویت اجرای دایرکتیوها (priority) و تداخل دایرکتیوهای ساختاری (ZEN-2302)
//   • الزام zen-key روی zen-for (ZEN-2303)
//   • قلاب‌های چرخهٔ عمر onMount / onUnmount / onUpdate و خطای خارج از دامنه (ZEN-2301)
//   • provide / inject درختی و سطح اپ
//   • پلاگین دوباره‌نصب‌نشدنی (idempotent)
//   • dispose() ⇒ صفر listener/effect باقی
//   • Hydration با نشانگرهای data-zen-h و عدم تطابق ZEN-2310
//   • assertCompatible ⇒ ZEN-2320

import { describe, it, expect } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { ZenithError } from '@zenith/errors';
import {
  createApp,
  defineDirective,
  definePlugin,
  onMount,
  onUnmount,
  onUpdate,
  provide,
  inject,
  useApp,
  assertCompatible,
  hydrate,
  APP_OPTIONS_DEFAULTS,
  resolveAppOptions,
} from '../src/index';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

describe('@zenith/runtime-core (#148, SPEC §2.8)', () => {
  it('exports frozen APP_OPTIONS_DEFAULTS and validates AppOptions', () => {
    expect(Object.isFrozen(APP_OPTIONS_DEFAULTS)).toBe(true);
    expect(resolveAppOptions().idPrefix).toBe('zen');

    const badPrefix = catchError(() => createApp({ idPrefix: '' }));
    expect(badPrefix.code).toBe('ZEN-1004');

    const unknownOpt = catchError(() => createApp({ unknownKey: 1 } as any));
    expect(unknownOpt.code).toBe('ZEN-1002');
  });

  it('runs two createApp instances simultaneously on the same page with isolated state, directives, and plugins', () => {
    const rootA = document.createElement('div');
    rootA.innerHTML = `<span class="msg" zen-text="msg"></span><i zen-badge="a"></i>`;
    const rootB = document.createElement('div');
    rootB.innerHTML = `<span class="msg" zen-text="msg"></span><i zen-badge="b"></i>`;

    const msgA = signal('Hello A');
    const msgB = signal('Hello B');

    let installCountA = 0;
    const myPlugin = definePlugin({
      name: 'test-plugin',
      install() {
        installCountA++;
      },
    });

    const appA = createApp({ state: { msg: msgA } });
    // Installing same plugin twice on appA only runs install once
    appA.use(myPlugin).use(myPlugin);
    expect(installCountA).toBe(1);

    appA.directive(
      defineDirective({
        name: 'zen-badge',
        bind(el, ctx) {
          el.setAttribute('data-badge-a', ctx.expr);
        },
      }),
    );

    const appB = createApp({ state: { msg: msgB } });

    appA.mount(rootA);
    appB.mount(rootB);

    expect(rootA.querySelector('.msg')!.textContent).toBe('Hello A');
    expect(rootB.querySelector('.msg')!.textContent).toBe('Hello B');
    expect(rootA.querySelector('i')!.getAttribute('data-badge-a')).toBe('a');
    // appB does not have zen-badge registered
    expect(rootB.querySelector('i')!.getAttribute('data-badge-a')).toBeNull();

    msgA.set('Updated A');
    flushSync();
    expect(rootA.querySelector('.msg')!.textContent).toBe('Updated A');
    expect(rootB.querySelector('.msg')!.textContent).toBe('Hello B');

    appA.dispose();
    appB.dispose();

    // After dispose(), reactive effects are cleaned up
    msgA.set('After dispose');
    flushSync();
    expect(rootA.querySelector('.msg')!.textContent).toBe('Updated A');
  });

  it('executes directives in descending priority order and detects structural conflicts (ZEN-2302) and missing zen-key (ZEN-2303)', () => {
    const order: string[] = [];
    const app = createApp();
    app.directive({
      name: 'zen-low',
      priority: 200,
      bind() {
        order.push('low-200');
      },
    });
    app.directive({
      name: 'zen-high',
      priority: 750,
      bind() {
        order.push('high-750');
      },
    });
    app.directive({
      name: 'zen-mid',
      priority: 500,
      bind() {
        order.push('mid-500');
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `<div zen-low="1" zen-mid="2" zen-high="3"></div>`;
    app.mount(root);
    expect(order).toEqual(['high-750', 'mid-500', 'low-200']);
    app.dispose();

    // Structural conflict: zen-for + zen-if on same element => ZEN-2302
    const conflictRoot = document.createElement('div');
    conflictRoot.innerHTML = `<ul><li zen-for="item in items" zen-key="item" zen-if="show"></li></ul>`;
    const conflictErr = catchError(() =>
      createApp({ state: { items: [1], show: true } }).mount(conflictRoot),
    );
    expect(conflictErr.code).toBe('ZEN-2302');

    // Missing zen-key on zen-for => ZEN-2303
    const noKeyRoot = document.createElement('div');
    noKeyRoot.innerHTML = `<ul><li zen-for="item in items" zen-text="item"></li></ul>`;
    const noKeyErr = catchError(() => createApp({ state: { items: ['a', 'b'] } }).mount(noKeyRoot));
    expect(noKeyErr.code).toBe('ZEN-2303');
  });

  it('supports core directives: zen-for+zen-key, zen-if/else-if/else, zen-model, zen-bind, zen-show, zen-ref, zen-action, zen-static', () => {
    const items = signal(['alpha', 'beta']);
    const mode = signal<'a' | 'b' | 'c'>('a');
    const username = signal('Ali');
    const visible = signal(true);
    const inputRef = signal<HTMLElement | null>(null);
    let clicked = 0;

    const app = createApp({
      state: {
        items,
        mode,
        username,
        visible,
        inputRef,
        inc() {
          clicked++;
        },
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <ul class="list"><li zen-for="item in items" zen-key="$item" zen-text="$item"></li></ul>
      <div class="cond">
        <p class="branch-a" zen-if="mode === 'a'">A</p>
        <p class="branch-b" zen-else-if="mode === 'b'">B</p>
        <p class="branch-c" zen-else>C</p>
      </div>
      <input class="inp" zen-ref="inputRef" zen-model="username" zen-model-trim />
      <span class="box" zen-show="visible" zen-bind:data-name="username"></span>
      <button class="btn" zen-action:click.prevent="inc"></button>
      <div class="static" zen-static><span zen-text="username">untouched</span></div>
    `;

    const unmount = app.mount(root);

    expect(Array.from(root.querySelectorAll('.list li')).map((li) => li.textContent)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(root.querySelector('.branch-a')?.textContent).toBe('A');
    expect(root.querySelector('.branch-b')).toBeNull();

    mode.set('b');
    items.set(['alpha', 'beta', 'gamma']);
    flushSync();

    expect(Array.from(root.querySelectorAll('.list li')).map((li) => li.textContent)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(root.querySelector('.branch-a')).toBeNull();
    expect(root.querySelector('.branch-b')?.textContent).toBe('B');

    mode.set('c');
    flushSync();
    expect(root.querySelector('.branch-c')?.textContent).toBe('C');

    // zen-ref + zen-model
    const inp = root.querySelector('.inp') as HTMLInputElement;
    expect(inputRef.get()).toBe(inp);
    expect(inp.value).toBe('Ali');
    inp.value = '  Reza  ';
    inp.dispatchEvent(new Event('input'));
    flushSync();
    expect(username.get()).toBe('Reza');
    expect(root.querySelector('.box')?.getAttribute('data-name')).toBe('Reza');

    // zen-show
    visible.set(false);
    flushSync();
    expect((root.querySelector('.box') as HTMLElement).style.display).toBe('none');

    // zen-action
    (root.querySelector('.btn') as HTMLButtonElement).click();
    expect(clicked).toBe(1);

    // zen-static skipped its child zen-text
    expect(root.querySelector('.static span')?.textContent).toBe('untouched');

    unmount();
    expect(inputRef.get()).toBeNull();
  });

  it('supports lifecycle hooks (onMount, onUnmount, onUpdate), tree-scoped provide/inject, and throws ZEN-2301 outside scope', () => {
    expect(catchError(() => onMount(() => {})).code).toBe('ZEN-2301');
    expect(catchError(() => onUnmount(() => {})).code).toBe('ZEN-2301');
    expect(catchError(() => onUpdate(() => {})).code).toBe('ZEN-2301');
    expect(catchError(() => useApp()).code).toBe('ZEN-2301');

    const events: string[] = [];
    const count = signal(0);
    const app = createApp({ state: { count } });
    app.provide('theme', 'root-dark');

    app.directive({
      name: 'zen-provider',
      priority: 600,
      bind(_el, ctx) {
        provide('theme', ctx.expr);
        onMount(() => {
          events.push(`mount:${useApp().id}`);
          return () => events.push('mount-cleanup');
        });
        onUnmount(() => {
          events.push('unmount');
        });
        onUpdate(() => {
          events.push(`update:${count.get()}`);
        });
      },
    });

    app.directive({
      name: 'zen-consumer',
      bind(el) {
        el.textContent = String(inject('theme', 'none'));
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <span class="root-consumer" zen-consumer=""></span>
      <div zen-provider="scoped-light" zen-text="count"></div>
      <div zen-provider="subtree-theme"><b class="sub-consumer" zen-consumer=""></b></div>
    `;

    const unmount = app.mount(root);
    expect(root.querySelector('.root-consumer')?.textContent).toBe('root-dark');
    expect(root.querySelector('.sub-consumer')?.textContent).toBe('subtree-theme');
    expect(events.some((e) => e.startsWith('mount:'))).toBe(true);

    count.set(1);
    flushSync();
    expect(events).toContain('update:1');

    unmount();
    expect(events).toContain('unmount');
    expect(events).toContain('mount-cleanup');
  });

  it('hydrates SSR DOM with data-zen-h markers and reports ZEN-2310 on mismatch', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<span data-zen-h="zen-1" zen-text="greeting">Server Text</span>`;

    const errors: ZenithError[] = [];
    const warnings: string[] = [];
    const greeting = signal('Client Text');

    const res = await hydrate(root, {
      state: { greeting },
      errorHandler: (e) => errors.push(e),
      warnHandler: (msg) => warnings.push(msg),
    });

    expect(res.hydrated).toBe(true);
    expect(res.mismatches.length).toBe(1);
    expect(errors[0]?.code).toBe('ZEN-2310');
    expect(warnings[0]).toContain('ZEN-2310');
    // Client mount reconciled textContent
    expect(root.querySelector('span')?.textContent).toBe('Client Text');
    res.cleanup();
  });

  it('assertCompatible throws ZEN-2320 when @zenith/* versions are not in lockstep', () => {
    expect(() =>
      assertCompatible({
        '@zenith/runtime-core': '1.5.0',
        '@zenith/schema': '1.5.2',
      }),
    ).not.toThrow();

    const err = catchError(() =>
      assertCompatible({
        '@zenith/runtime-core': '1.5.0',
        '@zenith/state': '1.4.0',
      }),
    );
    expect(err.code).toBe('ZEN-2320');
  });
});
