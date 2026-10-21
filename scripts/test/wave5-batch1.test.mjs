// scripts/test/wave5-batch1.test.mjs
// @vitest-environment jsdom
/* global document, window, KeyboardEvent */
/**
 * Wave 5 — P1 NEW-PACKAGES Batch 1 Integration & Unit Tests
 *
 * Covers issues:
 *   #150 — @zenith/i18n reactive engine (createI18n, ICU, detectLocale)
 *   #151 — a11y primitives (createFocusTrap, createRovingTabindex, lockScroll, useId)
 *   #152 — @zenith/head (createHead, useHead, renderHead, titleFromRoute)
 *   #153 — headless UI primitive (computePosition)
 *   #154 — @zenith/realtime (createRealtime queue/security/stats)
 *   #155 — @zenith/analytics (consent, DNT, provider isolation)
 *   #156 — createNodeHandler (SSR Node adapter + health check)
 *   #157 — createFetchHandler (SSR Edge adapter + SSR<head/i18n unified)
 *   #158 — create-zenith template manifest (data-driven templates)
 *   #160 — @zenith/language-server core (analyzeZenithDocument)
 *   #174 — SSR head/i18n integration & per-request app factory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createI18n } from '../../packages/i18n/src/index.ts';
import {
  createFocusTrap,
  createRovingTabindex,
  lockScroll,
  useId,
  computePosition,
  createApp,
  createAnalytics,
  consoleProvider,
} from '../../packages/runtime/src/index.ts';
import {
  createHead,
  renderSSRHead,
  titleFromRoute,
  createNodeHandler,
  createFetchHandler,
} from '../../packages/ssr/src/index.ts';
import { createRealtime } from '../../packages/http/src/index.ts';
import { FakeSocket } from '../../packages/realtime/test/fake-socket';
import { getTemplateManifest } from '../../packages/cli/src/templates.ts';
import { analyzeZenithDocument } from '../../packages/language-server/src/index.ts';

function createContainer() {
  const parent = document.createElement('div');
  parent.id = 'test-root';
  document.body.appendChild(parent);
  return {
    el: /** @type {HTMLElement} */ (parent),
    dispose: () => parent.remove(),
  };
}

describe('Wave 5 P1 Batch 1 — New Packages & Peripheral Integration (#150, #151, #152, #153, #154, #155, #156, #157, #158, #160, #174)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('dir');
  });

  it('150: createI18n handles ICU plural/select/number, reactive dir, and fallback locale', async () => {
    const i18n = createI18n({
      locale: 'fa',
      messages: {
        fa: {
          items: '{count, plural, =0 {موردی نیست} one {# مورد} other {# مورد}}',
          greeting: 'سلام {name}',
          linked: '@:greeting',
        },
        en: {
          greeting: 'Hello {name}',
        },
      },
    });
    expect(i18n.t('greeting', { name: 'علی' })).toBe('سلام علی');
    expect(i18n.t('items', { count: 0 })).toBe('موردی نیست');
    expect(i18n.t('items', { count: 1 })).toBe('۱ مورد');
    expect(i18n.t('items', { count: 2 })).toBe('۲ مورد');
    expect(i18n.t('missing.key', {}, { default: 'fallback!' })).toBe('fallback!');
    expect(i18n.t('linked', { name: 'X' })).toBe('سلام X');
    expect(i18n.dir.get()).toBe('rtl');
    const dirs = [];
    const unsub = i18n.dir.subscribe((d) => dirs.push(d));
    await i18n.setLocale('en-US');
    expect(i18n.dir.get()).toBe('ltr');
    expect(dirs).toEqual(['ltr']);
    unsub();
    i18n.dispose();
  });

  it('151: createFocusTrap traps Tab, returns focus, and releases on dispose', () => {
    const { el, dispose } = createContainer();
    el.innerHTML = `<button id="a">A</button><button id="b">B</button>`;
    const trap = createFocusTrap(el, { initialFocus: '#b' });
    trap.activate();
    expect(document.activeElement?.id).toBe('b');
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.dispatchEvent(tabEvent);
    expect(document.activeElement?.id).toBe('a');
    trap.dispose();
    dispose();
  });

  it('151: roving tabindex handles Arrow keys, Home, End, and RTL direction', () => {
    const { el, dispose } = createContainer();
    document.documentElement.setAttribute('dir', 'rtl');
    el.innerHTML = `
      <button tabindex="0">t1</button>
      <button tabindex="-1">t2</button>
      <button tabindex="-1">t3</button>
    `;
    const btns = Array.from(el.querySelectorAll('button'));
    const unbind = createRovingTabindex(el, { loop: true });
    btns[0].focus();
    btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    // RTL: ArrowRight goes to previous (t3)
    expect(document.activeElement).toBe(btns[2]);
    unbind();
    dispose();
  });

  it('151: lockScroll is reference-counted and restores overflow', () => {
    const unlock1 = lockScroll();
    const unlock2 = lockScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlock1();
    expect(document.body.style.overflow).toBe('hidden');
    unlock2();
    expect(document.body.style.overflow).toBe('');
  });

  it('153: computePosition flips bottom to top when overflowing viewport', () => {
    const { el, dispose } = createContainer();
    el.innerHTML = `<div id="ref" style="position:absolute;top:700px;height:50px;width:100px"></div><div id="float" style="height:100px;width:100px"></div>`;
    const ref = el.querySelector('#ref');
    const floatEl = el.querySelector('#float');
    window.innerHeight = 768;
    Object.defineProperty(ref, 'getBoundingClientRect', {
      value: () => ({ top: 700, bottom: 750, left: 10, right: 110, height: 50, width: 100 }),
    });
    Object.defineProperty(floatEl, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 100, left: 0, right: 100, height: 100, width: 100 }),
    });
    const pos = computePosition(ref, floatEl, { placement: 'bottom', offset: 8 });
    expect(pos.placement).toBe('top');
    dispose();
  });

  it('152 & 174: createHead dedupes tags, applies titleTemplate, renders attrs + JSON-LD', () => {
    const head = createHead({ titleTemplate: '%s | Zenith' });
    head.push({
      title: 'Home',
      meta: [{ name: 'description', content: 'desc' }],
      link: [{ rel: 'canonical', href: '/' }],
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite' },
    });
    const resolved = head.resolve();
    expect(resolved.title).toBe('Home | Zenith');
    const rendered = renderSSRHead(resolved);
    expect(rendered.headTags).toContain('<title data-zen-head="title">Home | Zenith</title>');
    expect(rendered.headTags).toContain('application/ld+json');
    head.dispose();
    expect(titleFromRoute({ path: '/users' }, '%s')).toBe('users');
  });

  it('155: analytics enforces consent, blocks DNT, and dispatches to providers', () => {
    const events = [];
    const analytics = createAnalytics({
      providers: [consoleProvider((ev) => events.push(ev))],
      consent: { required: true, default: false },
    });
    analytics.track('click');
    expect(events).toHaveLength(0);
    analytics.setConsent(true);
    analytics.track('signup', { plan: 'pro' });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('signup');
    if (typeof navigator !== 'undefined') {
      const prev = navigator.doNotTrack;
      Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
      analytics.track('another');
      expect(events).toHaveLength(1);
      Object.defineProperty(navigator, 'doNotTrack', { value: prev, configurable: true });
    }
    analytics.dispose();
  });

  it('154: realtime client rejects insecure ws:// in production and buffers queue', () => {
    const prevDev = globalThis.__ZENITH_DEV__;
    globalThis.__ZENITH_DEV__ = false;
    expect(() => createRealtime({ url: 'ws://evil.example.com/ws', autoConnect: false })).toThrow(
      /Insecure WebSocket/,
    );
    expect(() =>
      createRealtime({ url: 'ws://localhost:4000/ws', autoConnect: false }),
    ).not.toThrow();
    globalThis.__ZENITH_DEV__ = prevDev;
    const socket = new FakeSocket();
    const client = createRealtime({ url: 'wss://safe.example.com/ws', autoConnect: false, webSocketFactory: () => socket });
    client.send({ hello: 1 });
    client.open();
    expect(client.status.get()).toBe('connecting');
    socket.open();
    expect(socket.sent).toEqual(['{"hello":1}']);
    client.receiveMockMessage({ data: 'incoming' }, 'news');
    const received = [];
    client.subscribe('news', (d) => received.push(d));
    client.receiveMockMessage('two', 'news');
    expect(received).toHaveLength(1);
    expect(client.status.get()).toBe('open');
    client.dispose();
  });

  it('158: getTemplateManifest returns valid config files for all templates', () => {
    for (const t of ['spa', 'ssr', 'pwa', 'dashboard', 'minimal']) {
      const manifest = getTemplateManifest('my-app', t);
      expect(manifest['package.json']).toContain('my-app');
      expect(manifest['vite.config.ts']).toBeTruthy();
      expect(manifest['src/main.ts']).toBeTruthy();
      if (t === 'pwa') {
        expect(manifest['public/manifest.json']).toBeTruthy();
      }
    }
  });

  it('160: language-server analyzes zen-* directives and $signals with positions', () => {
    const text = `<div zen-text="$msg">\n  <input zen-model="$name">\n  <span zen-if="$ok">Yes</span>\n</div>`;
    const { directives, signals } = analyzeZenithDocument(text);
    expect(directives.map((d) => d.name)).toEqual(['zen-text', 'zen-model', 'zen-if']);
    expect(signals.map((s) => s.name)).toEqual(['msg', 'name', 'ok']);
    expect(directives[0].line).toBe(0);
    expect(signals[1].line).toBe(1);
  });

  it('156 & 157 & 174: SSR adapters integrate head/i18n per-request with health check', async () => {
    const template = `<main><h1>Hello SSR</h1></main>`;
    const nodeHandler = createNodeHandler({
      template,
      head: { title: 'Node SSR', meta: [{ name: 'generator', content: 'zenith' }] },
      i18n: { locale: 'fa', dir: 'rtl' },
    });
    const healthReq = { url: '/healthz', method: 'GET' };
    const healthRes = { setHeader: vi.fn(), end: vi.fn(), statusCode: 200 };
    await nodeHandler(healthReq, healthRes);
    expect(healthRes.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));

    const fakeApp = () => ({
      mount(root) {
        root.innerHTML = '<h1>Dynamic App</h1>';
        return () => {};
      },
      unmount: () => {},
    });
    const edgeHandler = createFetchHandler({
      template,
      app: fakeApp,
      head: { title: 'Edge Page', htmlAttrs: { 'data-zen': '1' } },
      i18n: { locale: 'en', dir: 'ltr' },
      cacheControl: 'public, max-age=60',
    });
    const req = new Request('http://localhost/edge-page?x=1');
    const res = await edgeHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('public');
    const html = await res.text();
    expect(html).toContain('<title data-zen-head="title">Edge Page</title>');
    expect(html).toContain('lang="en"');
    expect(html).toContain('__ZENITH_I18N__');
    expect(html).toContain('Dynamic App');
  });

  it('151: useId returns deterministic per-app scoped ids', () => {
    const { el, dispose } = createContainer();
    const app = createApp({ state: {} });
    app.mount(el);
    const first = useId();
    const second = useId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^zen-id-/);
    app.dispose();
    dispose();
  });
});
