import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { signal } from '@zenith/state';
import { createApp, defineDirective } from '@zenith/runtime';
import { registerAction, hasAction } from '@zenith/actions';
import {
  renderToString,
  registerServerComponent,
  getServerComponent,
  clearServerComponents,
  createAsyncContextStore,
  isAsyncLocalStorageAvailable,
  getSSRRuntimeEnv,
} from '@zenith/ssr';

describe('@zenith/ssr concurrent isolation & Edge runtime (#92)', () => {
  it('isolates 100 concurrent SSR requests across state, route, components, serverComponents, actions, and locale without leakage', async () => {
    // Register a global action and server component before the stress test
    // to verify concurrent request teardowns never wipe global registrations.
    const cleanupGlobalAction = registerAction('globalPing', () => {});
    const cleanupGlobalSC = registerServerComponent({
      name: 'global-footer',
      render: () => '<footer>GlobalFooter</footer>',
    });

    const CONCURRENCY = 100;

    const tasks = Array.from({ length: CONCURRENCY }, (_, i) => {
      const reqId = i + 1;
      const locale = i % 2 === 0 ? 'fa' : 'en';
      const route = `/users/${reqId}`;
      const userSignal = signal(`User-${reqId}`);

      // Each request defines the SAME component name (<zen-component name="user-card">)
      // and the SAME server-component name ("req-banner") with different content and async delay!
      const html = `
        <div class="page" zen-bind:data-locale="$locale">
          <zen-server-component name="req-banner" prop:id="$reqId" />
          <zen-component name="user-card">
            <template>
              <article class="card-${reqId}"><span class="name" zen-text="$user"></span></article>
            </template>
          </zen-component>
          <user-card prop:user="$user"></user-card>
          <zen-server-component name="global-footer" />
        </div>
      `;

      return renderToString(
        html,
        {
          reqId,
          user: userSignal,
        },
        {
          route,
          locale,
          serverComponents: {
            'req-banner': async (props) => {
              // Random micro-delay to interleave async execution across the 100 requests
              await new Promise((r) => setTimeout(r, (reqId % 7) + 1));
              return `<header class="banner-${reqId}">Banner:${props.id}:${locale}</header>`;
            },
          },
          actions: {
            saveUser: () => {},
          },
        },
      ).then((res) => ({ reqId, locale, route, res }));
    });

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(CONCURRENCY);

    for (const { reqId, locale, route, res } of results) {
      expect(res.route).toBe(route);
      expect(res.html).toContain(`data-locale="${locale}"`);
      expect(res.html).toContain(
        `<header class="banner-${reqId}">Banner:${reqId}:${locale}</header>`,
      );
      expect(res.html).toContain(`class="card-${reqId}"`);
      expect(res.html).toContain(`<span class="name" zen-text="$user">User-${reqId}</span>`);
      expect(res.html).toContain('<footer>GlobalFooter</footer>');

      // Verify no other request's ID leaked into this request's HTML or serialized state
      const parsedState = JSON.parse(res.state);
      expect(parsedState.reqId).toBe(reqId);
      expect(parsedState.user).toBe(`User-${reqId}`);
      expect(parsedState.locale).toBe(locale);
    }

    // Global registrations must still be intact after 100 concurrent Zen.stop() calls
    expect(hasAction('globalPing')).toBe(true);
    expect(getServerComponent('global-footer')).toBeDefined();

    cleanupGlobalAction();
    cleanupGlobalSC();
    clearServerComponents();
  }, 30000);

  it('supports isolated createApp instances (options.app) in concurrent SSR', async () => {
    const badgeDirectiveA = defineDirective({
      name: 'badge',
      bind(el, ctx) {
        el.setAttribute('data-app', `A:${ctx.expr}`);
      },
    });
    const badgeDirectiveB = defineDirective({
      name: 'badge',
      bind(el, ctx) {
        el.setAttribute('data-app', `B:${ctx.expr}`);
      },
    });

    const appA = createApp();
    appA.directive(badgeDirectiveA);
    const appB = createApp();
    appB.directive(badgeDirectiveB);

    const [resA, resB] = await Promise.all([
      renderToString(
        `<div zen-badge="one"><span zen-text="msg"></span></div>`,
        { msg: signal('Hello from A') },
        { app: appA, route: '/a' },
      ),
      renderToString(
        `<div zen-badge="two"><span zen-text="msg"></span></div>`,
        { msg: signal('Hello from B') },
        { app: appB, route: '/b' },
      ),
    ]);

    expect(resA.html).toContain('data-app="A:one"');
    expect(resA.html).toContain('Hello from A');
    expect(resB.html).toContain('data-app="B:two"');
    expect(resB.html).toContain('Hello from B');

    appA.dispose();
    appB.dispose();
  });

  it('uses native Node ALS without getBuiltinModule or a global polyfill, with a custom DOM', async () => {
    expect(isAsyncLocalStorageAvailable()).toBe(true);
    expect(getSSRRuntimeEnv()).toBe('node');

    // Node 18 has neither getBuiltinModule nor a global ALS constructor.
    const proc = (globalThis as any).process;
    const origGetBuiltin = proc.getBuiltinModule;
    const origGlobalAls = (globalThis as any).AsyncLocalStorage;
    try {
      proc.getBuiltinModule = undefined;
      delete (globalThis as any).AsyncLocalStorage;

      const edgeStore = createAsyncContextStore<{ id: string }>();
      const observed = await edgeStore.run({ id: 'edge-req-1' }, async () => {
        await Promise.resolve();
        return edgeStore.getStore()?.id;
      });
      expect(observed).toBe('edge-req-1');
      expect(edgeStore.getStore()).toBeUndefined();
    } finally {
      proc.getBuiltinModule = origGetBuiltin;
      if (origGlobalAls !== undefined) {
        (globalThis as any).AsyncLocalStorage = origGlobalAls;
      }
    }

    // Verify renderToString with custom createDOM (Edge DOM provider pattern)
    let customDomUsed = false;
    const edgeRes = await renderToString(
      `<section><h1 zen-text="$title"></h1></section>`,
      { title: 'Edge SSR Ready' },
      {
        route: '/edge',
        createDOM(fullHtml, url) {
          customDomUsed = true;
          const dom = new JSDOM(fullHtml, { url });
          return { window: dom.window, close: () => dom.window.close() };
        },
      },
    );

    expect(customDomUsed).toBe(true);
    expect(edgeRes.html).toContain('Edge SSR Ready');
    expect(edgeRes.route).toBe('/edge');
  });
});
