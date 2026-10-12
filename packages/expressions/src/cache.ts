// packages/expressions/src/cache.ts
//
// Cache: مرحله‌ی چهارم از کامپایل Expression.
// ASTهای Compile شده را در حافظه نگه می‌دارد تا از Parse مجدد جلوگیری شود.
//
// #144: این فایل روی @zenith/cache (L0, SPEC §۲.۴) مهاجرت کرد.
// رفتار عمومی حفظ شده است:
//   - LRU با حداکثر اندازه (پیش‌فرض ۵۰۰) — touched فقط در get (نه peek).
//   - آمار hits/misses/hitRatio هم‌شکل گذشته (فیلدهای افزوده cache بیرون
//     از این سازگاه حذف می‌شوند تا API عمومی expressions ثابت بماند).
//   - امنیت: قبل از Cache، validate اجرا می‌شود؛ خطا ⇒ cache نمی‌شود
//     (miss شمرده می‌شود، همان رفتار قبلی).
import { createCache, type Cache } from '@zenith/cache';

import { Parser, type ASTNode } from './parser';
import { validate } from './validator';
import { sanitizeExpression } from './security-constants';

/**
 * حداکثر تعداد Expressionهای Cache شده.
 *
 * چرا ۵۰۰؟
 *   - برای اکثر اپلیکیشن‌ها کافی است.
 *   - اگر بیشتر شد، overhead حافظه‌ی Map نگران‌کننده می‌شود.
 *   - در اپ‌های خیلی بزرگ، می‌توان این مقدار را افزایش داد.
 */
let MAX_CACHE_SIZE = 500;

/** کش ASTها — TTL ندارد (انقضای lazy هم لازم نیست؛ کرکرهٔ اندازه LRU). */
let cache: Cache<ASTNode> = createCache<ASTNode>({ ttl: 'never', maxSize: MAX_CACHE_SIZE });

/**
 * کامپایل یک Expression به AST.
 *
 * مراحل:
 *   1) اگر در Cache هست، برگردان (cache.get لمس LRU و آمار hit را انجام می‌دهد).
 *   2) وگرنه، parse کن، validate کن، cache کن، برگردان.
 *
 * @param expression رشته‌ی Expression.
 * @returns درخت AST.
 * @throws Error در صورت شکست syntax یا validation.
 */
export function compile(expression: string): ASTNode {
  // Sanitize expression before any processing
  const safeExpression = sanitizeExpression(expression);

  // ── ۱. Cache Hit: get => LRU touch + hits++ (miss هم خودکار شمرده می‌شود) ──
  const hit = cache.get(safeExpression);
  if (hit !== undefined) return hit;

  // ── ۲. Cache Miss: parse و validate ──
  const parser = new Parser(safeExpression);
  const ast = parser.parse();

  // اعتبارسنجی امنیتی (اگر شکست بخورد، cache نمی‌شود)
  validate(ast);

  // ── ۳. اضافه به Cache؛ trim داخلی همان LRU با MAX_CACHE_SIZE است ──
  cache.set(safeExpression, ast);

  return ast;
}

/**
 * پاک کردن Cache (برای استفاده در تست‌ها یا بعد از تغییرات بزرگ).
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * فقط برای Debug: تعداد Expressionهای Cache شده.
 */
export function getCacheSize(): number {
  return cache.size;
}

// ── I-2: پیکربندی Cache ──
export function configureCache(options: { maxSize?: number }): void {
  if (options.maxSize !== undefined && options.maxSize !== MAX_CACHE_SIZE) {
    MAX_CACHE_SIZE = options.maxSize;
    const prev = cache;
    // maxSize در @zenith/cache زمان ساخت خوانده می‌شود ⇒ نمونه تازه با
    // منتقل‌کردن entryهای زنده (peek ⇒ بدون تغییر آمار/ترتگی).
    cache = createCache<ASTNode>({ ttl: 'never', maxSize: MAX_CACHE_SIZE });
    for (const key of prev.keys()) {
      const ast = prev.peek(key);
      if (ast !== undefined) cache.set(key, ast);
    }
    prev.dispose();
  }
}

// ── I-3: آمار Cache ──
export function getCacheStats() {
  // سازگاه API عمومی expressions: بدون staleHits/pending/tagKeys/bytes
  const { size, maxSize, hits, misses, hitRatio } = cache.stats();
  return { size, maxSize, hits, misses, hitRatio };
}
