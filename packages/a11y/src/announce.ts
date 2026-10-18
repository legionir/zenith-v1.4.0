import { createReservedError } from '@zenith/errors';
import type { Cleanup, Disposable } from '@zenith/shared';
/** @public */
export interface LiveRegionOptions { doc?: Document; politeness?: 'polite' | 'assertive' | 'off'; clearAfter?: number; }
/** @public */
export interface LiveRegion extends Disposable { announce(message: string): void; readonly element: HTMLElement | null; }
function clientDocument(candidate?: Document): Document | undefined {
  const doc = candidate ?? (typeof document === 'undefined' ? undefined : document);
  return (doc as (Document & { __zenithSSR__?: boolean }) | undefined)?.__zenithSSR__ ? undefined : doc;
}
/** Text-only announcements, with owned timer and DOM node. @public */
export function createLiveRegion(options: LiveRegionOptions = {}): LiveRegion {
  const delay = options.clearAfter ?? 5000, politeness = options.politeness ?? 'polite';
  if (!['polite', 'assertive', 'off'].includes(politeness) || !Number.isFinite(delay) || delay < 0 || delay > 2147483647) throw createReservedError('ZEN-1403');
  const doc = clientDocument(options.doc), element = doc?.createElement('div') ?? null;
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
  if (element) {
    element.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    element.setAttribute('aria-live', politeness); element.setAttribute('aria-atomic', 'true');
    element.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    doc?.body?.append(element);
  }
  return { element, announce(message) {
    if (disposed || !element) return; clearTimeout(timer); element.textContent = message;
    if (delay > 0) timer = setTimeout(() => { if (!disposed) element.textContent = ''; }, delay);
  }, dispose() { if (disposed) return; disposed = true; clearTimeout(timer); element?.remove(); } };
}
/** One caller-owned announcement; cleanup removes the live region and pending timer. @public */
export function announce(message: string, options: LiveRegionOptions = {}): Cleanup {
  const region = createLiveRegion(options); region.announce(message);
  if (!region.element) return () => {};
  const timer = (options.clearAfter ?? 5000) > 0 ? setTimeout(() => region.dispose(), options.clearAfter ?? 5000) : undefined;
  return () => { clearTimeout(timer); region.dispose(); };
}
/** Minimal router hook; retain the explicit router owner rather than ambient state. @public */
export interface RouteAnnouncerOptions extends LiveRegionOptions {
  router: { afterEach(callback: (route: string | { path: string; meta?: Record<string, unknown> }) => void): Cleanup };
  mainSelector?: string; title?: (route: string | { path: string; meta?: Record<string, unknown> }) => string;
  message?: (title: string) => string; focusMain?: boolean;
}
/** Install once per router owner and release the hook/region on unmount. @public */
export function installRouteAnnouncer(options: RouteAnnouncerOptions): Cleanup {
  const doc = clientDocument(options.doc); if (!doc) return () => {};
  const selector = options.mainSelector ?? '[data-zen-main], main';
  try { doc.querySelector(selector); } catch { throw createReservedError('ZEN-1401'); }
  const region = createLiveRegion({ ...options, doc }); let active = true, off: Cleanup = () => {};
  try {
    off = options.router.afterEach(route => {
      if (!active) return;
      const title = options.title?.(route) ?? (doc.title || (typeof route === 'string' ? route : String(route.meta?.title ?? route.path)));
      const message = options.message?.(title) ?? `رفتید به ${title}`;
      if (!active) return; region.announce(message);
      const main = options.focusMain === false ? null : doc.querySelector<HTMLElement>(selector);
      if (main) {
        const before = main.getAttribute('tabindex');
        try { main.tabIndex = -1; main.focus({ preventScroll: true }); }
        finally { if (before === null) main.removeAttribute('tabindex'); else main.setAttribute('tabindex', before); }
      }
    });
  } catch (error) { active = false; region.dispose(); throw error; }
  return () => { if (!active) return; active = false; try { off(); } finally { region.dispose(); } };
}
