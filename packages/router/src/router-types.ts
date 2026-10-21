// packages/router/src/router-types.ts
//
// تایپ‌های مسیر و helpers پایه — استخراج مکانیکی از router.ts،
// بدون تغییر رفتار (#40).

import { routeSignal } from './route-state';


/**
 * Route definition interface.
 */
export interface Route {
  path: string;
  component?: string | (() => Promise<unknown>);
  lazy?: boolean;
  prefetch?: boolean;
  guard?: (params: Record<string, string>) => boolean | Promise<boolean>;
  /** Arbitrary metadata for the route (e.g. auth guards, page title). */
  meta?: Record<string, unknown>;
  children?: Route[];
}

/**
 * Current route information.
 */
export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  name?: string;
}

/**
 * Define application routes.
 */
export function defineRoutes(routes: Route[]): Route[] {
  return routes;
}

/**
 * Get current route context.
 */
export function useRoute(): RouteContext {
  const current = routeSignal.get();
  return {
    path: current.path,
    params: current.params,
    query: {},
  };
}
