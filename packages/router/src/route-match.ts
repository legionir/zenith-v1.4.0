// packages/router/src/route-match.ts
//
// تطبیق الگوی مسیر (matchRoute/findMatchingRoute) — ماژول خالص،
// استخراج مکانیکی از router.ts، بدون تغییر رفتار (#40).


/**
 * تطبیق یک الگوی مسیر با یک مسیر واقعی.

 * الگو می‌تواند شامل پارامترهای `:name` باشد. مثلا:
 *   matchRoute('/products/:id', '/products/101')  → { id: '101' }
 *   matchRoute('/users/:userId/posts/:postId', '/users/5/posts/12')
 *     → { userId: '5', postId: '12' }
 *   matchRoute('/', '/')  → {}
 *   matchRoute('/', '/about')  → null
 *
 * Wildcard: الگوی `**` با هر مسیری تطبیق می‌شود (برای صفحات 404).
 *   matchRoute('**', '/anything')  → {} (همیشه تطبیق می‌خورد)
 *
 * BUG-RTR-01 (v1.3.0): مسیر قبل از تطبیق نرمالایز می‌شود (double slashes حذف
 * و trailing slash trimmed). قبلاً `filter(Boolean)` فقط empty segments را
 * حذف می‌کرد و `//` در URL باعث تطبیق اشتباه (مثلاً `//users` با `:id` تطبیق
 * می‌خورد در حالی که URL نامعتبر است).
 *
 * @param pattern الگوی مسیر (مثل `/products/:id` یا `**`).
 * @param path    مسیر واقعی (مثل `/products/101`).
 * @returns آبجکت پارامترها در صورت تطبیق، یا `null` در صورت عدم تطبیق.
 */

/**
 * BUG-RTR-01 (v1.3.0): Normalize a URL path by removing double slashes
 * and trimming trailing slashes. This ensures that `/users//profile` is
 * treated as `/users/profile` rather than silently matching a wrong route.
 */
function normalizePath(urlPath: string): string {
  return urlPath.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  // ── Wildcard `**` — با هر مسیری تطبیق می‌خورد ──
  if (pattern === '**') {
    return {};
  }

  // BUG-RTR-01 (v1.3.0): Normalize both pattern and path so double slashes
  // are collapsed before comparison. Without this, `/users//profile` would
  // silently match `/users/:id` (since filter(Boolean) removes empty parts).
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(path);

  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const pathParts = normalizedPath.split('/').filter(Boolean);

  // اگر تعداد بخش‌ها برابر نبود (و الگو wildcard نبود)، تطبیق نمی‌خورد.
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]!;
    const pathPart = pathParts[i]!;

    if (patternPart.startsWith(':')) {
      // پارامتر: مقدار را در params ذخیره کن.
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // تطبیق دقیق: اگر برابر نبود، null برگردان.
      return null;
    }
  }
  return params;
}

/**
 * پیدا کردن اولین مسیر منطبق از لیست مسیرها.
 *
 * @param routes   لیست مسیرها (با فیلدهای `path` و `src`).
 * @param path     مسیر فعلی.
 * @returns اولین مسیر منطبق همراه با params، یا `null` اگر هیچ‌کدام منطبق نبود.
 */
export function findMatchingRoute<T extends { path: string }>(
  routes: T[],
  path: string,
): { route: T; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchRoute(route.path, path);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}
