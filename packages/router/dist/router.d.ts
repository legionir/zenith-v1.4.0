import { type Signal } from '@zenith/state';
/**
 * وضعیت مسیر فعلی.
 *
 * @property path   مسیر فعلی (مثل `/products/101`).
 * @property params پارامترهای استخراج‌شده از مسیر (مثل `{ id: '101' }`).
 */
export interface RouteState {
    path: string;
    params: Record<string, string>;
}
/**
 * Proxy Signal که در SSR به context فعلی اشاره می‌کند.
 *
 * این Proxy interface همانند یک Signal واقعی عمل می‌کند:
 *   - get(): اگر در SSR context است، از AsyncLocalStorage می‌خواند.
 *            در غیر این صورت، از browserRouteSignal.
 *   - set(): اگر در SSR context است، در AsyncLocalStorage می‌نویسد.
 *            در غیر این صورت، در browserRouteSignal.
 *
 * این الگو به navigate() و setRouteParams() اجازه می‌دهد بدون تغییر،
 * هم در مرورگر و هم در SSR کار کنند — با isolation کامل در SSR.
 */
export declare const routeSignal: Signal<RouteState>;
/**
 * اجرای یک تابع در context یک route مشخص (برای SSR).
 *
 * هر درخواست SSR باید این تابع را با route خود صدا بزند. داخل callback،
 * routeSignal به یک Signal مستقل اشاره می‌کند که فقط در این context قابل
 * دسترسی است. این از race condition بین درخواست‌های concurrent جلوگیری می‌کند.
 *
 * استفاده:
 *   const html = await runWithRoute('/users/123', async () => {
 *     return await renderToString(template, state);
 *   });
 *
 * @param initialPath مسیر اولیه برای این context.
 * @param fn تابع که در context اجرا می‌شود.
 * @returns نتیجه‌ی fn.
 */
export declare function runWithRoute<T>(initialPath: string, fn: () => Promise<T> | T): Promise<T>;
/**
 * نسخه‌ی sync از runWithRoute برای مواردی که callback sync است.
 *
 * استفاده:
 *   const result = runWithRouteSync('/users/123', () => {
 *     // کد sync
 *   });
 */
export declare function runWithRouteSync<T>(initialPath: string, fn: () => T): T;
/**
 * تطبیق یک الگوی مسیر با یک مسیر واقعی.
 *
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
 * @param pattern الگوی مسیر (مثل `/products/:id` یا `**`).
 * @param path    مسیر واقعی (مثل `/products/101`).
 * @returns آبجکت پارامترها در صورت تطبیق، یا `null` در صورت عدم تطبیق.
 */
export declare function matchRoute(pattern: string, path: string): Record<string, string> | null;
/**
 * پیدا کردن اولین مسیر منطبق از لیست مسیرها.
 *
 * @param routes   لیست مسیرها (با فیلدهای `path` و `src`).
 * @param path     مسیر فعلی.
 * @returns اولین مسیر منطبق همراه با params، یا `null` اگر هیچ‌کدام منطبق نبود.
 */
export declare function findMatchingRoute<T extends {
    path: string;
}>(routes: T[], path: string): {
    route: T;
    params: Record<string, string>;
} | null;
/**
 * تغییر مسیر بدون رفرش صفحه.
 *
 * این تابع:
 *   1) `history.pushState` را فراخوانی می‌کند تا URL مرورگر عوض شود.
 *   2) `routeSignal` را آپدیت می‌کند تا تمام Effectهای وابسته (مثل
 *      `<zen-router>`) دوباره اجرا شوند.
 *
 * در SSR (داخل runWithRoute)، این تابع فقط context signal را آپدیت می‌کند
 * (history.pushState فراخوانی نمی‌شود چون window وجود ندارد).
 *
 * @param path مسیر جدید (مثل `/products/101`).
 */
export declare function navigate(path: string): void;
/**
 * آپدیت params در routeSignal.
 *
 * این تابع توسط `<zen-router>` فراخوانی می‌شود وقتی یک مسیر منطبق پیدا می‌کند.
 * params در Signal ذخیره می‌شود تا در Expressionها با `$route.params.id` قابل
 * دسترسی باشد.
 *
 * @param params پارامترهای استخراج‌شده از مسیر.
 */
export declare function setRouteParams(params: Record<string, string>): void;
export declare function installPopstateListener(): void;
/**
 * پاکسازی listener های Router (برای تست‌ها و HMR).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export declare function cleanupRouter(): void;
//# sourceMappingURL=router.d.ts.map