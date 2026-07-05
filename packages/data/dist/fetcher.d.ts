/**
 * شکل وضعیت fetch.
 *
 * @property loading آیا درخواست در حال انجام است؟
 * @property error   پیام خطا در صورت شکست، یا `null`.
 * @property data    داده‌های دریافت‌شده در صورت موفقیت، یا `null`.
 */
export interface FetchState<T = any> {
    loading: boolean;
    error: string | null;
    data: T | null;
}
/**
 * پردازش دایرکتیو zen-fetch.
 *
 * این تابع نقطه‌ی ورود اصلی سیستم Data Fetching است. توسط walker فراخوانی
 * می‌شود وقتی به عنصری با attribute `zen-fetch` می‌رسد.
 *
 * مراحل:
 *   1) نام state را از `zen-state` (یا پیش‌فرض "data") می‌گیرد.
 *   2) یک Signal محلی برای fetch state می‌سازد.
 *   3) Context محلی می‌سازد که `$<stateName>` به آن Signal اشاره می‌کند.
 *   4) فرزندان را با Context محلی process می‌کند.
 *   5) یک Effect ایجاد می‌کند که URL را watch می‌کند و fetch را انجام می‌دهد.
 *
 * @param el              عنصری که zen-fetch روی آن است.
 * @param expr            Expression URL (مثلا `"/api/users"` یا `"/api/products/${$route.params.id}"`).
 * @param context         Context والد.
 * @param processChildren callback برای walk فرزندان.
 *                        امضا: (node, context, disposes) => void
 * @param disposes        آرایه‌ی dispose functions والد.
 */
export declare function processFetch(el: HTMLElement, expr: string, context: Record<string, any>, processChildren: (node: HTMLElement, context: Record<string, any>, disposes: (() => void)[]) => void, disposes: (() => void)[]): void;
//# sourceMappingURL=fetcher.d.ts.map