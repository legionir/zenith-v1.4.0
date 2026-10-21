// packages/service-worker/src/strategy-apply.ts
//
// dispatch نام استراتژی — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).

import { deprecate, developerError, ErrorCode } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { cacheFirst } from './strategy-cache-first';
import { networkFirst } from './strategy-network-first';
import { staleWhileRevalidate } from './strategy-stale';
import { networkOnly, cacheOnly } from './strategy-simple';
import { cacheThenNetwork } from './strategy-cache-then-network';
import type { CacheStrategyName } from './strategy-types';


/**
 * FEATURE (v0.4.0): Dispatch به استراتژی با نام.
 *
 * تابعی کمکی برای route-matching: نام استراتژی را می‌گیرد و تابع مناسب را صدا می‌زند.
 *
 * نکته: برای `cacheThenNetwork`، `onUpdate` در این مسیر ست نمی‌شود (تنها cache در
 * پس‌زمینه به‌روز می‌شود). برای callback، استراتژی را مستقیماً صدا بزنید.
 *
 * @param strategyName نام استراتژی.
 * @param request      درخواست.
 * @param cacheName    نام cache.
 * @param timeout      timeout برای networkFirst.
 */
/** @public */
export function applyStrategy(strategyName: CacheStrategyName, request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use applyStrategy(strategyName, request, { cacheName, timeout }). */
export function applyStrategy(strategyName: CacheStrategyName, request: Request, cacheName: string, timeout?: number): Promise<Response>;
export async function applyStrategy(strategyName: CacheStrategyName, request: Request, options: CacheStrategyOptions | string, legacyTimeout?: number): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-082', 'applyStrategy(strategyName, request, cacheName, timeout)', 'applyStrategy(strategyName, request, { cacheName, timeout })');
  const config = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options, timeout: legacyTimeout }) : options);
  switch (strategyName) {
    case 'cacheFirst':
      return cacheFirst(request, config);
    case 'networkFirst':
      return networkFirst(request, config);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request, config);
    case 'networkOnly':
      return networkOnly(request);
    case 'cacheOnly':
      return cacheOnly(request, config);
    case 'cacheThenNetwork':
      return cacheThenNetwork(request, config);
    default: {
      // TypeScript exhaustiveness check — اگر در آینده نوع استراتژی اضافه شد،
      // اینجا خطای compile-time بگیرد.
      const _exhaustive: never = strategyName;
      throw developerError(
        `Unknown strategy: ${String(_exhaustive)}`,
        ErrorCode.INTERNAL_DEVELOPER_ERROR,
      );
    }
  }
}
