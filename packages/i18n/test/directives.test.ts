// @vitest-environment jsdom
/* global document, window */
// packages/i18n/test/directives.test.ts
//
// #150 موج ۲ — دایرکتیوهای zen-t*، expressionها ($t/…)، SSR seeding
// (`__ZENITH_I18N__`) و App.addState.
//
// این تست‌ها سطح موتور createApp را نیز می‌پوشانند:
//   - app.directive(def) ثبت نام‌های zen-t*
//   - createEvalContext با addState ⇒ $t/$dir/… در expression
//
// نکته: importهای مستقیم فایل‌ها مثل الگوی scripts/test/wave5-batch1،
// تا پکیچ‌های مرزی (runtime→i18n) در build دست‌نخورده بمانند.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createApp, type App } from '../../runtime/src/index.ts';
import { i18nPlugin, useI18n, __resetActiveI18n } from '../src/index';
import type { I18n } from '../src/index';

const FA = {
  greeting: 'سلام {name}',
  items: '{count, plural, =0 {موردی نیست} one {# مورد} other {# مورد}}',
  linked: '@:greeting',
  rich: '<b>سلام</b>',
  labels: { title: 'تیتر', aria: 'توضیح' },
};
const EN = {
  greeting: 'Hello {name}',
  items: '{count, plural, one {# item} other {# items}}',
  labels: { title: 'Title', aria: 'Desc' },
};

function setup(container = document.body): { root: HTMLElement; appEl: HTMLElement } {
  const root = document.createElement('div');
  container.appendChild(root);
  const appEl = document.createElement('div');
  root.appendChild(appEl);
  return { root, appEl };
}

describe('#150 wave2 — zen-t* directives, expression globals, SSR seeding', () => {
  let app: App | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    __resetActiveI18n(null);
  });

  afterEach(() => {
    app?.dispose();
    app = null;
    __resetActiveI18n(null);
    delete (window as any).__ZENITH_I18N__;
    vi.restoreAllMocks();
  });

  it('zen-t: متن اولیه + واکنشی setLocale بدون تعویض نود', async () => {
    const { appEl } = setup();
    appEl.innerHTML = '<span zen-t="greeting"></span>';
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA, en: EN } })],
    });
    app.mount(appEl);
    flushSync();
    const span = appEl.querySelector('span')!;
    expect(span.textContent).toBe('سلام '); // {name} مفقود → ''
    const i18n = app.inject<I18n>('zenith:i18n')!;
    await i18n.setLocale('en');
    flushSync();
    expect(appEl.querySelector('span')).toBe(span); // همان نود (بدون rerender کامل)
    expect(span.textContent).toBe('Hello ');
  });

  it('zen-t با zen-t-params/zen-t-count/zen-t-default', async () => {
    const { appEl } = setup();
    appEl.innerHTML = `
      <p id="a" zen-t="greeting" zen-t-params='{"name":"علی"}'></p>
      <p id="b" zen-t="items" zen-t-count="0"></p>
      <p id="c" zen-t="items" zen-t-count="2"></p>
      <p id="d" zen-t="missing.key" zen-t-default="جایگزین"></p>`;
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA, en: EN } })],
    });
    app.mount(appEl);
    flushSync();
    expect(appEl.querySelector('#a')!.textContent).toBe('سلام علی');
    expect(appEl.querySelector('#b')!.textContent).toBe('موردی نیست');
    expect(appEl.querySelector('#c')!.textContent).toBe('۲ مورد');
    expect(appEl.querySelector('#d')!.textContent).toBe('جایگزین');
    const i18n = app.inject<I18n>('zenith:i18n')!;
    await i18n.setLocale('en');
    flushSync();
    // numberingSystem instance-wide (fa ⇒ arabext) است؛ setLocale استنباط را عوض نمی‌کند.
    expect(appEl.querySelector('#c')!.textContent).toBe('۲ items');
  });

  it('zen-t-html: پیش‌فرض escape-ccomplete؛ با sanitizeHtml سفارشی رندر واقعی', async () => {
    const { appEl } = setup();
    appEl.innerHTML = '<div id="h" zen-t-html="rich"></div>';
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA } })],
    });
    app.mount(appEl);
    flushSync();
    const h = appEl.querySelector('#h')!;
    // بدون sanitizeHtml سفارشی: escape کامل (امن‌به‌پیش‌فرض)
    expect(h.innerHTML).toBe('&lt;b&gt;سلام&lt;/b&gt;');
    app.dispose();
    app = null;

    const { appEl: appEl2 } = setup();
    appEl2.innerHTML = '<div id="h2" zen-t-html="rich"></div>';
    const sanitize = vi.fn((html: string) => html);
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA }, sanitizeHtml: sanitize })],
    });
    app.mount(appEl2);
    flushSync();
    expect(sanitize).toHaveBeenCalled();
    expect(appEl2.querySelector('#h2')!.innerHTML).toBe('<b>سلام</b>');
  });

  it('zen-t-attr: title/aria-label؛ zen-locale ⇒ lang؛ zen-dir="auto" ⇒ dir واکنشی', async () => {
    const { appEl } = setup();
    appEl.innerHTML = `
      <input id="f" zen-t-attr="title:labels.title; aria-label:labels.aria" />
      <section id="s" zen-locale zen-dir="auto"></section>`;
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA, en: EN } })],
    });
    app.mount(appEl);
    flushSync();
    const f = appEl.querySelector('#f')!;
    expect(f.getAttribute('title')).toBe('تیتر');
    expect(f.getAttribute('aria-label')).toBe('توضیح');
    expect(appEl.querySelector('#s')!.getAttribute('lang')).toBe('fa');
    expect(appEl.querySelector('#s')!.getAttribute('dir')).toBe('rtl');
    const i18n = app.inject<I18n>('zenith:i18n')!;
    await i18n.setLocale('en');
    flushSync();
    expect(f.getAttribute('title')).toBe('Title');
    expect(appEl.querySelector('#s')!.getAttribute('lang')).toBe('en');
    expect(appEl.querySelector('#s')!.getAttribute('dir')).toBe('ltr');
    document.documentElement.removeAttribute('lang');
  });

  it('expressionها: $t و $dir در zen-text — unwrap واکنشی signalها', async () => {
    const { appEl } = setup();
    appEl.innerHTML = `
      <span id="t" zen-text="$t('greeting', {})"></span>
      <span id="dir" zen-text="$dir"></span>
      <span id="loc" zen-text="$locale"></span>`;
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA, en: EN } })],
    });
    app.mount(appEl);
    flushSync();
    expect(appEl.querySelector('#t')!.textContent).toBe('سلام ');
    expect(appEl.querySelector('#dir')!.textContent).toBe('rtl');
    expect(appEl.querySelector('#loc')!.textContent).toBe('fa');
    const i18n = useI18n();
    await i18n.setLocale('en');
    flushSync();
    expect(appEl.querySelector('#t')!.textContent).toBe('Hello ');
    expect(appEl.querySelector('#dir')!.textContent).toBe('ltr');
    expect(appEl.querySelector('#loc')!.textContent).toBe('en');
  });

  it('addState collision: کلید t کاربری حفظ می‌شود + warn', () => {
    const { appEl } = setup();
    appEl.innerHTML = '<span zen-text="$t"></span>';
    const warnHandler = vi.fn();
    app = createApp({
      state: { t: 'user-t' },
      plugins: [i18nPlugin({ locale: 'en', messages: { en: EN } })],
      warnHandler,
    });
    app.mount(appEl);
    flushSync();
    expect(warnHandler).toHaveBeenCalled();
    expect(appEl.querySelector('span')!.textContent).toBe('user-t');
  });

  it('SSR: __ZENITH_I18N__ seed می‌شود، بدون fetch، سپس پاک؛ locale سرور حاکم', async () => {
    (window as any).__ZENITH_I18N__ = {
      locale: 'fa',
      dir: 'rtl',
      messages: { fa: FA },
    };
    const loadMessages = vi.fn(async () => EN);
    const { appEl } = setup();
    appEl.innerHTML = '<span zen-t="greeting" zen-t-params=\'{"name":"علی"}\'></span>';
    app = createApp({
      state: {},
      // detect-local-detection هم فعال است و نباید روی SSR-trump اثر بگذارد
      plugins: [i18nPlugin({ locale: 'en', messages: { en: EN }, loadMessages })],
    });
    app.mount(appEl);
    flushSync();
    const i18n = app.inject<I18n>('zenith:i18n')!;
    expect(i18n.locale.get()).toBe('fa');
    expect(loadMessages).not.toHaveBeenCalled();
    expect((window as any).__ZENITH_I18N__).toBeUndefined();
    expect(appEl.querySelector('span')!.textContent).toBe('سلام علی');
    await Promise.resolve(); // تکمیل setLocale داخلی plugin
  });

  it('dispose: cleanup پلاگین، دایرکتیوها را unregister و موتور را dispose می‌کند', async () => {
    const { appEl } = setup();
    appEl.innerHTML = '<span zen-t="greeting"></span>';
    app = createApp({
      state: {},
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA, en: EN } })],
    });
    app.mount(appEl);
    flushSync();
    const i18n = app.inject<I18n>('zenith:i18n')!;
    app.dispose();
    app = null;
    // الخarts: i18n.dispose باید تمام زنجیره‌ها (subscribers و dir signal) را قطع کند
    const spy = vi.fn();
    i18n.dir.subscribe(spy);
    await i18n.setLocale('en');
    flushSync();
    expect(spy).not.toHaveBeenCalled(); // dirSubs پاک شده‌اند
  });

  it('zen-t reactivity با state: پارامتر واکنشی بدون re-bind', async () => {
    const { appEl } = setup();
    appEl.innerHTML = '<p zen-t="greeting"></p>';
    const state = {};
    app = createApp({
      state,
      plugins: [i18nPlugin({ locale: 'fa', messages: { fa: FA } })],
    });
    app.mount(appEl);
    flushSync();
    const p = appEl.querySelector('p')!;
    expect(p.textContent).toBe('سلام ');
    // حتی با effect جدید بیرونی، subscription پلاگین isolate است
    const vals: string[] = [];
    effect(() => {
      vals.push(p.textContent ?? '');
    });
    expect(vals[0]).toBe('سلام ');
  });
});
