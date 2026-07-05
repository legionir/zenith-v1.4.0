import { Signal } from '@zenith/state';
/**
 * Type of the route signal provider function.
 * برمی‌گرداند `{ path: string; params: Record<string, string> } | undefined`.
 */
type RouteStateProvider = () => {
    path: string;
    params: Record<string, string>;
} | undefined;
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
export declare function setRouteSignalProvider(provider: RouteStateProvider | null): void;
/**
 * Type guard: بررسی اینکه یک مقدار یک Signal است یا نه.
 *
 * چرا از instanceof استفاده نمی‌کنیم؟
 *   - اگر چند instance از Signal در پکیج‌های مختلف وجود داشته باشد
 *     (مثلاً با Monorepoهایی که multiple builds دارند)،
 *     instanceof ممکن است false برگرداند.
 *   - Type guard بر اساس ساختار duck typing قابل اعتمادتر است.
 */
declare function isSignal(value: any): value is Signal<any>;
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
export declare function createContext(state: Record<string, any>): Record<string, any>;
/**
 * Helper برای تشخیص نوع State (برای استفاده در directives).
 */
export { isSignal };
//# sourceMappingURL=context.d.ts.map