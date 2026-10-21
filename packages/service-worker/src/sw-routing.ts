// packages/service-worker/src/sw-routing.ts
//
// تطبیق request با routeها — استخراج مکانیکی از sw.ts،
// بدون تغییر رفتار (#40).

import type { RouteMatcher, SWRuntimeConfig } from './sw-types';


/**
 * FEATURE (v0.4.0): تطبیق یک request با route ها.
 *
 * اولین route که match شود برنده است. ترتیب routes مهم است.
 */
export function matchRoute(cfg: SWRuntimeConfig, request: Request): RouteMatcher | null {
  const url = request.url;
  const method = (request.method || 'GET').toUpperCase();
  for (const route of cfg.routes) {
    // تطبیق URL.
    let urlMatch = false;
    if (route.urlPattern instanceof RegExp) {
      urlMatch = route.urlPattern.test(url);
    } else if (typeof route.urlPattern === 'string') {
      urlMatch = url.includes(route.urlPattern);
    }
    if (!urlMatch) continue;

    // تطبیق method (اگر ست شده باشد).
    if (route.method) {
      const routeMethod = route.method.toUpperCase();
      if (routeMethod !== method) continue;
    }

    return route;
  }
  return null;
}
