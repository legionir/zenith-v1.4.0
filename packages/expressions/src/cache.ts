// packages/expressions/src/cache.ts
//
// Cache: مرحله‌ی چهارم از کامپایل Expression.
// ASTهای Compile شده را در حافظه نگه می‌دارد تا از Parse مجدد جلوگیری شود.
//
// چرا Cache کردن مهم است؟
//   - در یک اپلیکیشن Zenith، ممکن است هزاران Template Binding وجود داشته باشد.
//   - مثلاً `zen-text="$user.name"` ممکن است ۱۰۰ بار در ۱۰۰ کامپوننت استفاده شود.
//   - بدون Cache، هر بار که یک Effect اجرا می‌شود، باید این Expression دوباره Parse شود.
//   - با Cache، فقط اولین بار Parse می‌شود و دفعات بعد فقط evaluate.
//
// استراتژی: LRU Cache با حداکثر اندازه
//   - Map در JavaScript ترتیب insertion را حفظ می‌کند.
//   - برای LRU: وقتی cache پر شد، اولین entry (oldest) حذف می‌شود.
//   - وقتی یک entry hit می‌شود، حذف و دوباره اضافه می‌شود تا به آخر منتقل شود.
//
// امنیت:
//   - قبل از Cache، validate اجرا می‌شود تا اگر Expression مخربی بود
//     به جای cache، خطا پرتاب شود.

import { Parser, ASTNode } from './parser';
import { validate } from './validator';

/**
 * حداکثر تعداد Expressionهای Cache شده.
 *
 * چرا ۵۰۰؟
 *   - برای اکثر اپلیکیشن‌ها کافی است.
 *   - اگر بیشتر شد، overhead حافظه‌ی Map نگران‌کننده می‌شود.
 *   - در اپ‌های خیلی بزرگ، می‌توان این مقدار را افزایش داد.
 */
let MAX_CACHE_SIZE = 500;

/**
 * Cache سراسری برای ASTها.
 *
 * استفاده از Map (نه Object) به این دلایل:
 *   - ترتیب insertion را حفظ می‌کند (برای LRU لازم است).
 *   - Performance بهتر برای تعداد زیاد entry.
 */
// ── I-2: Cache Metrics ──
let cacheHits = 0;
let cacheMisses = 0;

const cache = new Map<string, ASTNode>();

/**
 * کامپایل یک Expression به AST.
 *
 * مراحل:
 *   1) اگر در Cache هست، برگردان (LRU touch).
 *   2) وگرنه، parse کن، validate کن، cache کن، برگردان.
 *
 * @param expression رشته‌ی Expression.
 * @returns درخت AST.
 * @throws Error در صورت شکست syntax یا validation.
 */
export function compile(expression: string): ASTNode {
  // ── ۱. Cache Hit: فقط به آخر منتقلش کن (LRU touch) ──
  if (cache.has(expression)) {
    cacheHits++;
    const ast = cache.get(expression)!;
    // حذف و اضافه‌ی مجدد برای به‌روزرسانی ترتیب
    cache.delete(expression);
    cache.set(expression, ast);
    return ast;
  }

  cacheMisses++;

  // ── ۲. Cache Miss: parse و validate ──
  const parser = new Parser(expression);
  const ast = parser.parse();

  // اعتبارسنجی امنیتی (اگر شکست بخورد، cache نمی‌شود)
  validate(ast);

  // ── ۳. اضافه به Cache با احترام به MAX_CACHE_SIZE ──
  if (cache.size >= MAX_CACHE_SIZE) {
    // حذف قدیمی‌ترین entry (اولین key در Map)
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(expression, ast);

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
  if (options.maxSize !== undefined) {
    MAX_CACHE_SIZE = options.maxSize;
  }
}

// ── I-3: آمار Cache ──
export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    hitRatio: total > 0 ? cacheHits / total : 0,
  };
}
