import { createAnalytics as createEngine, bindTrack, doNotTrack, type Analytics } from '@zenith/analytics';
import { defaultApp, type App } from '@zenith/runtime-core';
/** Trusted legacy callback: the element stays in the local closure, never in analytics payloads. @public */
export type AnalyticsHandler = (eventName: string, el: HTMLElement) => void | Promise<void>;
/** Explicit privacy grant; merely installing a handler is not consent. @public */
export interface LegacyAnalyticsOptions { consent?: boolean; }
const HANDLER = Symbol.for('zenith.legacyAnalytics.handler');
const CONSENT = Symbol.for('zenith.legacyAnalytics.consent');
const BINDINGS = Symbol.for('zenith.legacyAnalytics.bindings');
const ENGINES = Symbol.for('zenith.legacyAnalytics.engines');
const CANCEL_PENDING = Symbol.for('zenith.legacyAnalytics.cancelPending');
function legacyOwner(): App {
  const owner = defaultApp();
  owner.use({ name: 'zenith:legacy-analytics', install(app) {
    const bindings = new Set<() => void>(); const engines = new Set<Analytics>();
    app.provide(BINDINGS, bindings); app.provide(ENGINES, engines); app.provide(CANCEL_PENDING, new Set<() => void>()); app.provide(CONSENT, false);
    return () => { for (const release of [...bindings]) release(); for (const engine of engines) engine.dispose(); engines.clear(); bindings.clear(); };
  } });
  return owner;
}
/** Legacy API backed by the canonical consent/DNT/queue/failure policy. @public */
export function configureAnalytics(handler: AnalyticsHandler | null, options: LegacyAnalyticsOptions = {}): void {
  const owner = legacyOwner(); setAnalyticsConsent(false); owner.provide(HANDLER, handler); setAnalyticsConsent(handler !== null && options.consent === true);
}
/** Withdrawal cancels queued engine events; scheduled legacy callbacks recheck before dispatch. @public */
export function setAnalyticsConsent(granted: boolean): void {
  const owner = legacyOwner(); owner.provide(CONSENT, Boolean(granted));
  if (!granted) for (const cancel of owner.inject<Set<() => void>>(CANCEL_PENDING)!) cancel();
  for (const engine of owner.inject<Set<Analytics>>(ENGINES)!) engine.setConsent(Boolean(granted));
}
/** @deprecated Use bindTrack or analyticsPlugin; retained as the same engine adapter. @public */
export function processTrack(el: HTMLElement, trackAttr: string, context: Record<string, unknown>): () => void {
  if (typeof window === 'undefined' || (el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  const owner = legacyOwner(); const bindings = owner.inject<Set<() => void>>(BINDINGS)!; const engines = owner.inject<Set<Analytics>>(ENGINES)!;
  const pending = new Map<ReturnType<typeof setTimeout>, () => void>(); let disposed = false;
  const cancellers = owner.inject<Set<() => void>>(CANCEL_PENDING)!;
  const cancelPending = () => { for (const [timer, resolve] of pending) { clearTimeout(timer); resolve(); } pending.clear(); }; cancellers.add(cancelPending);
  const engine = createEngine({ consent: { required: true, default: owner.inject<boolean>(CONSENT) ?? false }, respectDNT: true, autoPageViews: false, batch: { size: 1, interval: 0 }, providers: [{ name: 'legacy-callback', send(event) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(timer);
        if (disposed || !engine.hasConsent() || !owner.inject<boolean>(CONSENT) || doNotTrack()) { resolve(); return; }
        const handler = owner.inject<AnalyticsHandler | null>(HANDLER);
        try { Promise.resolve(handler?.(event.name, el)).then(resolve, reject); } catch (error) { reject(error); }
      }, 0);
      pending.set(timer, resolve);
    });
  } }] });
  engines.add(engine);
  let stop: () => void = () => {};
  const release = () => {
    if (disposed) return; disposed = true; bindings.delete(release); engines.delete(engine); cancellers.delete(cancelPending);
    try { stop(); } finally { cancelPending(); engine.dispose(); }
  };
  try { stop = bindTrack(el, { analytics: engine, context, expression: trackAttr, onDispose: reason => { if (reason === 'once') void engine.flush().then(release, release); else release(); } }); bindings.add(release); return release; }
  catch (error) { release(); throw error; }
}
export { createAnalytics, consoleProvider, beaconProvider, gtagProvider, plausibleProvider } from '@zenith/analytics/legacy';
export type { AnalyticsEvent, AnalyticsProvider, AnalyticsOptions, AnalyticsInstance } from '@zenith/analytics/legacy';
