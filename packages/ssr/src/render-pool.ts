// packages/ssr/src/render-pool.ts
//
// استخر DOM و کش قالب‌ها — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import type { SSRDOMWindow } from './dom-types';


export interface PooledDOMEntry {
  window: SSRDOMWindow;
  templates: Map<string, HTMLTemplateElement>;
}

export const MAX_DOM_POOL_SIZE = 8;
export const MAX_TEMPLATE_CACHE_ENTRIES = 128;
export const _jsdomPool: PooledDOMEntry[] = [];
const _templateParseCounts = new Map<string, number>();
export let templateCacheEpoch = 0;
export function recordTemplateParse(html: string): void {
  const count = _templateParseCounts.get(html) ?? 0; _templateParseCounts.delete(html);
  if (_templateParseCounts.size >= MAX_TEMPLATE_CACHE_ENTRIES) { const oldest = _templateParseCounts.keys().next().value; if (oldest !== undefined) _templateParseCounts.delete(oldest); }
  _templateParseCounts.set(html, count + 1);
}

/**
 * #91: پاک‌سازی کش قالب‌های SSR و استخر JSDOM.
 */
export function clearSSRTemplateCache(): void {
  templateCacheEpoch++; _templateParseCounts.clear();
  while (_jsdomPool.length > 0) {
    const entry = _jsdomPool.pop();
    try {
      entry?.window?.close?.();
    } catch {
      /* ignore close errors */
    }
  }
}

/**
 * #91: آمار کش قالب‌های SSR برای تست و مانیتورینگ عملکرد.
 */
export function getSSRTemplateCacheStats(): {
  cachedTemplates: number;
  pooledDOMInstances: number;
  parseCountFor: (html: string) => number;
} {
  return {
    cachedTemplates: _templateParseCounts.size,
    pooledDOMInstances: _jsdomPool.length,
    parseCountFor: (html: string) => _templateParseCounts.get(html) ?? 0,
  };
}
