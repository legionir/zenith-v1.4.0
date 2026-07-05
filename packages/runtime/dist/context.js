// packages/runtime/src/context.ts
//
// پل بین موتور Reactivity (فاز ۱) و موتور Expressions (فاز ۲).
//
// مسئولیت: تبدیل یک آبجکت State (که شامل Signalها است) به یک Context
// که برای Expression Engine قابل استفاده باشد.
//
// نکته‌ی کلیدی: استفاده از Object.defineProperty با getter.
// هر بار که Expression به `$user` دسترسی پیدا می‌کند، getter اجرا می‌شود
// و در حین اجرا، `user.get()` فراخوانی می‌شود که Dependency Tracking
// را به صورت خودکار فعال می‌کند. این یعنی:
//   - وقتی user.set(...) فراخوانی شود، تمام Effectهایی که به $user وابسته‌اند
//     به صورت خودکار دوباره اجرا می‌شوند.
//   - نیازی به manual subscription نیست.
//
// ── فاز ۸: تزریق $route ──
// در فاز ۸، Route Signal سراسری به‌صورت `$route` به Context اضافه می‌شود.
// این کار با **dependency injection** انجام می‌شود (نه static import) تا
// runtime به‌صورت hard به @zenith/router وابسته نباشد. اگر @zenith/router
// نصب نباشد یا setRouteSignalProvider فراخوانی نشود، `$route` در Context
// موجود نخواهد بود (و Expressionهایی که به آن دسترسی دارند خطا خواهند داد).
//
// این الگو به runtime اجازه می‌دهد بدون router هم کار کند (مثلاً در تست‌های
// واحد یا اپلیکیشن‌های بدون routing).
/**
 * Provider تزریق‌شده برای Route Signal.
 *
 * این متغیر توسط `setRouteSignalProvider` در زمان init تنظیم می‌شود.
 * اگر null باشد، `$route` در Context تعریف نمی‌شود.
 */
let routeSignalProvider = null;
/**
 * تزریق Route Signal Provider به runtime.
 *
 * این تابع توسط `@zenith/router` (یا هر پکیج دیگری که می‌خواهد routing فراهم کند)
 * در زمان init فراخوانی می‌شود. این الگو (dependency injection) به runtime
 * اجازه می‌دهد بدون وابستگی static به router کار کند.
 *
 * استفاده:
 *   import { setRouteSignalProvider } from '@zenith/runtime';
 *   import { routeSignal } from '@zenith/router';
 *   setRouteSignalProvider(() => routeSignal.get());
 *
 * @param provider تابعی که RouteState فعلی را برمی‌گرداند، یا null برای غیرفعال‌سازی.
 */
export function setRouteSignalProvider(provider) {
    routeSignalProvider = provider;
}
/**
 * Type guard: بررسی اینکه یک مقدار یک Signal است یا نه.
 *
 * چرا از instanceof استفاده نمی‌کنیم؟
 *   - اگر چند instance از Signal در پکیج‌های مختلف وجود داشته باشد
 *     (مثلاً با Monorepoهایی که multiple builds دارند)،
 *     instanceof ممکن است false برگرداند.
 *   - Type guard بر اساس ساختار duck typing قابل اعتمادتر است.
 */
function isSignal(value) {
    return (value !== null &&
        typeof value === 'object' &&
        typeof value.get === 'function' &&
        typeof value.set === 'function');
}
/**
 * ساخت Context از State.
 *
 * State می‌تواند شامل موارد زیر باشد:
 *   - Signal<T>: به یک getter با پیشوند `$` تبدیل می‌شود (مثل `$user`).
 *   - مقدار ساده (مثل عدد، رشته، آبجکت): مستقیماً در Context قرار می‌گیرد (مثل `$config`).
 *   - تابع (Service): به عنوان Service در Context قرار می‌گیرد (مثل `$api`).
 *
 * مثال:
 *   const state = {
 *     user: signal({ name: 'Ali' }),     // → context.$user (getter)
 *     config: { theme: 'dark' },          // → context.$config (object literal)
 *     api: { fetch: (url) => {...} },     // → context.$api (object literal)
 *   };
 *
 * در فاز ۸، علاوه بر State کاربر، `$route` هم به‌صورت خودکار اضافه می‌شود
 * (اگر @zenith/router نصب باشد).
 *
 * @param state آبجکت State که کاربر تعریف می‌کند.
 * @returns Context قابل استفاده در Expression Engine.
 */
export function createContext(state) {
    const context = {};
    for (const key in state) {
        // پیشوند $ به صورت خودکار اضافه می‌شود تا در Expressionها
        // با `$user` به جای `user` ارجاع داده شود.
        const contextKey = `$${key}`;
        const stateItem = state[key];
        if (isSignal(stateItem)) {
            // ── حالت ۱: Signal ──
            // با Object.defineProperty یک getter تعریف می‌کنیم.
            // هر بار که Expression به context.$user دسترسی پیدا کند:
            //   1) getter اجرا می‌شود
            //   2) stateItem.get() فراخوانی می‌شود
            //   3) اگر در حین اجرای یک Effect باشیم، Effect به عنوان
            //      subscriber این Signal ثبت می‌شود
            //   4) مقدار برگردانده می‌شود
            Object.defineProperty(context, contextKey, {
                get: () => stateItem.get(),
                enumerable: true,
                configurable: true,
            });
        }
        else {
            // ── حالت ۲: مقدار ساده / آبجکت / Service ──
            // مستقیماً در Context قرار می‌گیرد.
            // (مثل تم‌ها، API services، یا helper functions)
            context[contextKey] = stateItem;
        }
    }
    // ── فاز ۸: تزریق $route ──
    // اگر routeSignalProvider تنظیم شده باشد، `$route` به Context اضافه می‌شود.
    // این کار با dependency injection انجام می‌شود (نه static import) تا runtime
    // بدون وابستگی hard به router کار کند.
    //
    // نکته: از یک getter استفاده می‌کنیم که provider() را فراخوانی می‌کند.
    // اگر provider یک Signal.get() را در پس‌زمینه صدا بزند، dependency tracking
    // فعال می‌شود — هر Effect که به $route دسترسی دارد، وقتی navigate() فراخوانی
    // شود، دوباره اجرا می‌شود.
    if (routeSignalProvider) {
        Object.defineProperty(context, '$route', {
            get: () => routeSignalProvider(),
            enumerable: true,
            configurable: true,
        });
    }
    return context;
}
/**
 * Helper برای تشخیص نوع State (برای استفاده در directives).
 */
export { isSignal };
//# sourceMappingURL=context.js.map