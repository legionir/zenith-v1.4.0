// packages/service-worker/src/sw-options.ts
//
// اسکیماهای پیکربندی SW — استخراج مکانیکی از sw.ts، بدون تغییر رفتار (#40).

import { s, defineOptions } from '@zenith/schema';
import type { RouteMatcher, SWRuntimeConfig } from './sw-types';
import { CACHE_VERSION } from './sw-state';


/**
 * FEATURE (v0.4.0): ثبت پیکربندی SW.
 *
 * این تابع در فایل sw.js توسط کاربر صدا زده می‌شود:
 *
 *   import { setupSW } from '@zenith/service-worker/sw';
 *   setupSW({
 *     precache: ['/index.html', '/app.js'],
 *     routes: [
 *       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' },
 *       { urlPattern: /\/assets\//,  strategy: 'cacheFirst',  cacheName: 'assets' },
 *     ],
 *     defaultStrategy: 'networkOnly',
 *   });
 *
 * بعد از این، event listenerهای install/activate/fetch/sync ثبت می‌شوند.
 *
 * @public
 */
export const routeMatcherOptions = defineOptions<RouteMatcher>(
  'RouteMatcher',
  s.object({
    urlPattern: s.union([
      s.string({ min: 1 }),
      s.custom<RegExp>((v) => v instanceof RegExp, 'RegExp'),
    ]),
    method: s.optional(s.string({ min: 1 })),
    strategy: s.enum(SW_CACHE_STRATEGIES),
    cacheName: s.optional(s.string({ min: 1 })),
    timeout: s.optional(s.duration({ min: 0 })),
  }),
);

/** @public */
export const swRuntimeConfigOptions = defineOptions<SWRuntimeConfig>(
  'SWRuntimeConfig',
  s.object({
    precache: s.default(s.array(s.string({ min: 1 })), []),
    routes: s.default(s.array(routeMatcherOptions.schema), []),
    defaultCacheName: s.default(s.string({ min: 1 }), 'zenith-cache'),
    cachePrefix: s.default(s.string(), 'zenith-'),
    defaultStrategy: s.default(s.enum(SW_CACHE_STRATEGIES), 'networkOnly'),
    backgroundSyncQueueName: s.default(s.string({ min: 1 }), 'zenith-bg-sync'),
    cacheVersion: s.default(s.number({ int: true, min: 1 }), CACHE_VERSION),
    skipWaiting: s.default(s.boolean(), false),
    clientsClaim: s.default(s.boolean(), false),
  }),
);

/** @public */
export const SW_RUNTIME_CONFIG_DEFAULTS = swRuntimeConfigOptions.DEFAULTS;
/** @public */
export const swRuntimeConfigSchema = swRuntimeConfigOptions.schema;
/** @public */
export const resolveSWRuntimeConfig = (cfg?: unknown): SWRuntimeConfig =>
  swRuntimeConfigOptions.resolve(cfg);
