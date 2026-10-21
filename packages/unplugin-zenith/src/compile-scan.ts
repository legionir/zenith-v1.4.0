// packages/unplugin-zenith/src/compile-scan.ts
import type { TransformResult } from './compile-types';

/**
 * لیست مشترک directiveهای دارای expression که باید در compile-time اعتبارسنجی شوند.
 * FIX (B-9): به‌عنوان constant سطح ماژول تعریف شده تا هم در transformHtml
 * و هم در analyzeHtml استفاده شود — از دوگانگی کد جلوگیری می‌کند.
 *
 * هر directive که نیاز به یک zenith expression دارد و باید در build-time
 * اعتبارسنجی شود، باید اینجا اضافه شود.
 */
export const EXPRESSION_DIRECTIVES = new Set([
  'zen-text',
  'zen-if',
  'zen-show',
  'zen-bind',
  'zen-model',
  'zen-html',
  // FEATURE (v0.4.0): zen-html-trusted هم expression دارد مثل zen-html.
  'zen-html-trusted',
]);

/**
 * جایگزینی همه‌ی occurrences یک رشته در متن.
 *
 * FIX (B-4): String.prototype.replace() فقط اولین occurrence را جایگزین می‌کند،
 * اما این تابع با escape کردن regex special characters و استفاده از `g` flag
 * همه‌ی occurrenceها را جایگزین می‌کند.
 *
 * @param input متن اصلی
 * @param search رشته‌ای که باید جایگزین شود
 * @param replacement رشته جایگزین
 * @returns متن با همه‌ی occurrences جایگزین شده
 */
export function replaceAll(input: string, search: string, replacement: string): string {
  // escape کردن کاراکترهای ویژه regex
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return input.replace(regex, replacement);
}

/**
 * حافظه پنهان (cache) برای نتیجه hasZenithDirectives.
 * IMPROVEMENT (I-2): از WeakMap استفاده می‌کنیم که با GC جمع‌آوری می‌شود
 * وقتی HTML string از حافظه خارج شود. این از محاسبه مجدد regex برای
 * فایل‌های بزرگ بدون directive جلوگیری می‌کند.
 */
/**
 * Cache ساده (Map) برای نتیجه hasZenithDirectives.
 * از Map استفاده می‌شود چون WeakMap فقط object به عنوان کلید قبول می‌کند
 * و string (که primitive است) نمی‌تواند کلید WeakMap باشد.
 *
 * IMPROVEMENT (I-2): این cache از محاسبه مجدد regex برای فایل‌های بزرگ
 * بدون directive جلوگیری می‌کند.
 */
const MAX_COMPILE_CACHE_SIZE = 128;
const directiveCache = new Map<string, boolean>();
const transformCache = new Map<string, TransformResult>();
let transformCacheHits = 0;
let transformCacheMisses = 0;

export function setLruEntry<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maxSize = MAX_COMPILE_CACHE_SIZE,
): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

export function clearCompileCache(): void {
  directiveCache.clear();
  transformCache.clear();
  transformCacheHits = 0;
  transformCacheMisses = 0;
}

export function getCompileCacheStats(): {
  directiveEntries: number;
  transformEntries: number;
  hits: number;
  misses: number;
} {
  return {
    directiveEntries: directiveCache.size,
    transformEntries: transformCache.size,
    hits: transformCacheHits,
    misses: transformCacheMisses,
  };
}

/**
 * بررسی اینکه آیا یک فایل HTML directiveهای Zenith دارد.
 *
 * IMPROVEMENT (I-2): بهبود عملکرد با:
 *   1. early exit با includes('zen-') — بسیار سریع‌تر از regex
 *   2. cache برای جلوگیری از اسکن مجدد فایل‌های بزرگ
 */
export function hasZenithDirectives(html: string): boolean {
  // بررسی از cache
  const cached = directiveCache.get(html);
  if (cached !== undefined) {
    // ارتقا در LRU
    directiveCache.delete(html);
    directiveCache.set(html, cached);
    return cached;
  }

  // Early exit: اگر "zen-" در متن نباشد، قطعاً directiveای وجود ندارد.
  // این از اجرای regex روی فایل‌های بدون directive جلوگیری می‌کند.
  if (!html.includes('zen-')) {
    setLruEntry(directiveCache, html, false);
    return false;
  }

  // بررسی دقیق‌تر با regex
  const result = /\szen-[a-z]/i.test(html);
  setLruEntry(directiveCache, html, result);
  return result;
}

/**
 * استخراج نام فایل ماژول از مسیر HTML.
 * مثال: src/pages/home.html → home.zenith.js
 */
export function getModuleName(htmlPath: string): string {
  const base = htmlPath.split('/').pop() || 'app';
  const name = base.replace(/\.(html?|htm)$/i, '');
  return `${name}.zenith.js`;
}

/**
 * جست‌وجو در کش transform؛ در صورت hit شمارنده و LRU را به‌روز می‌کند و
 * کپی مستقل (warnings جدا) برمی‌گرداند. در صورت miss شمارندهٔ miss را
 * ثبت می‌کند و undefined برمی‌گرداند.
 */
export function lookupTransformCache(cacheKey: string): TransformResult | undefined {
  const cachedResult = transformCache.get(cacheKey);
  if (cachedResult !== undefined) {
    transformCacheHits += 1;
    transformCache.delete(cacheKey);
    transformCache.set(cacheKey, cachedResult);
    return {
      ...cachedResult,
      warnings: [...cachedResult.warnings],
    };
  }
  transformCacheMisses += 1;
  return undefined;
}

/**
 * ذخیرهٔ نتیجهٔ transform در کش LRU با کپی مستقل warnings.
 */
export function storeTransformCache(cacheKey: string, result: TransformResult): void {
  setLruEntry(transformCache, cacheKey, {
    ...result,
    warnings: [...result.warnings],
  });
}
