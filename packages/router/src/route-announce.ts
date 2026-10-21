// packages/router/src/route-announce.ts
//
// اعلان دسترس‌پذیر تغییر مسیر — استخراج مکانیکی از router.ts،
// بدون تغییر رفتار (#40).

import { installRouteAnnouncer as installA11yRouteAnnouncer, createLiveRegion, type LiveRegion, type LiveRegionOptions } from '@zenith/a11y';
import { titleFromRoute, type HeadManager, type HeadEntry } from '@zenith/head';
import { findMatchingRoute } from './route-match';
import { afterEach, registerRouterCleanup } from './router-navigate';
import type { Route } from './router-types';


/** Shared a11y/head adapter; legacy option names remain supported. @public */
export interface RouteAnnouncerOptions extends LiveRegionOptions {
  mainSelector?: string;
  title?: (to: string) => string;
  message?: (title: string) => string;
  focusMain?: boolean;
  /** Optional explicit owner for reactive route titles. */
  head?: HeadManager;
  routes?: readonly Route[];
  titleTemplate?: string;
  /** @deprecated Use mainSelector. */
  focusSelector?: string;
  /** @deprecated Use title or message. */
  formatAnnouncement?: (to: string) => string;
}
/** One owned shared live region and route hook; explicit cleanup also releases the head entry. @public */
export function installRouteAnnouncer(options: RouteAnnouncerOptions = {}): () => void {
  const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc || (doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  let active = true, entry: HeadEntry | undefined, unregister = () => {};
  const release = installA11yRouteAnnouncer({ ...options, doc,
    router: { afterEach: callback => afterEach(to => { if (active) callback(to); }) },
    mainSelector: options.mainSelector ?? options.focusSelector ?? '[data-zen-main], main',
    message: options.message ?? (options.formatAnnouncement ? title => title : undefined),
    title: route => {
      const to = typeof route === 'string' ? route : route.path;
      syncActiveRouteLinks(to, doc);
      const matched = options.routes ? findMatchingRoute([...options.routes], to.split('?')[0]!.split('#')[0]!) : undefined;
      const title = options.title?.(to) ?? (matched || options.head || options.titleTemplate ? titleFromRoute({ path: to, meta: matched?.route.meta }, options.titleTemplate) : doc.title || titleFromRoute({ path: to }));
      if (!active) return title;
      if (options.head) { if (entry) entry.patch({ title }); else { const acquired = options.head.push({ title }); if (!active) acquired.dispose(); else entry = acquired; } }
      return options.formatAnnouncement?.(to) ?? options.head?.resolve().title ?? title;
    },
  });
  const dispose = () => { if (!active) return; active = false; unregister(); try { release(); } finally { entry?.dispose(); entry = undefined; } };
  unregister = registerRouterCleanup(dispose);
  return dispose;
}
const legacyRouteRegions = new WeakMap<Document, LiveRegion>();
/** Compatibility facade backed by the shared live-region primitive; cleanupRouter releases it. @public */
export function announceRouteChange(
  titleOrPath: string,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): HTMLElement | null {
  if (!doc?.body || (doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return null;
  let region = legacyRouteRegions.get(doc);
  if (!region?.element?.isConnected) {
    region?.dispose(); region = createLiveRegion({ doc, clearAfter: 0 });
    if (!doc.getElementById('zen-route-announcer') && region.element) region.element.id = 'zen-route-announcer';
    const owned = region; legacyRouteRegions.set(doc, owned);
    registerRouterCleanup(() => { owned.dispose(); if (legacyRouteRegions.get(doc) === owned) legacyRouteRegions.delete(doc); });
  }
  region.announce(titleOrPath); return region.element;
}

/**
 * #98 (WCAG 2.2 AA): همگام‌سازی خودکار `aria-current="page"` روی لینک‌های فعال.
 */
export function syncActiveRouteLinks(
  currentPath: string,
  root: ParentNode | undefined = typeof document !== 'undefined' ? document : undefined,
): void {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const links = root.querySelectorAll('a[href], [zen-link]');
  const normalizedCurrent = currentPath.split('?')[0]!.split('#')[0]! || '/';
  links.forEach((node) => {
    const el = node as HTMLElement;
    const rawHref = el.getAttribute('zen-link') || el.getAttribute('href') || '';
    const cleanHref = rawHref.replace(/^#/, '').split('?')[0]!.split('#')[0]! || '/';
    if (cleanHref === normalizedCurrent) {
      el.setAttribute('aria-current', 'page');
    } else if (el.getAttribute('aria-current') === 'page') {
      el.removeAttribute('aria-current');
    }
  });
}
