import { createDisposer, type Cleanup } from '@zenith/shared';
import { createAnalytics } from './analytics';
import { bindTrack } from './directive';
import type { AnalyticsOptions } from './types';

/** Minimal structural integration avoids a runtime-core dependency from L2. @public */
export interface AnalyticsAppHost {
  provide(key: string | symbol, value: unknown): unknown;
  directive(definition: { name: string; bind(el: HTMLElement, context: { expr: string; context: Record<string, unknown>; state?: Record<string, unknown> }): Cleanup }): Cleanup;
}
/** Native string-route routers and object-route adapters share one hook. @public */
export interface AnalyticsPluginOptions extends AnalyticsOptions {
  router?: { afterEach(callback: (route: string | { path: string }) => void): Cleanup };
}
/** Each installed App owns its engine, consent, bindings and router subscription. @public */
export function analyticsPlugin(options: AnalyticsPluginOptions = {}) {
  return { name: 'zenith:analytics', install(app: AnalyticsAppHost): Cleanup {
    const { router, ...engineOptions } = options;
    const analytics = createAnalytics(engineOptions);
    const cleanup = createDisposer();
    cleanup.add(analytics);
    const bindings = new Set<Cleanup>();
    let disposed = false;
    const release = () => {
      if (disposed) return;
      disposed = true;
      for (const binding of bindings) cleanup.add(binding);
      bindings.clear();
      cleanup.dispose();
    };
    try {
      app.provide('zenith:analytics', analytics);
      cleanup.add(app.directive({ name: 'track', bind(el, ctx) {
        if (disposed) return () => {};
        let active = true;
        let disposeBinding: Cleanup = () => {};
        const owned = () => { if (!active) return; active = false; bindings.delete(owned); disposeBinding(); };
        disposeBinding = bindTrack(el, {
          analytics, context: { ...ctx.state, ...ctx.context }, expression: ctx.expr,
          onDispose: () => { active = false; bindings.delete(owned); },
        });
        if (active) bindings.add(owned);
        return owned;
      } }));
      if ((options.autoPageViews ?? true) && router) cleanup.add(router.afterEach(route => {
        if (!disposed) analytics.page(typeof route === 'string' ? route : route.path);
      }));
      return release;
    } catch (error) { try { release(); } catch { /* retain install failure */ } throw error; }
  } };
}
