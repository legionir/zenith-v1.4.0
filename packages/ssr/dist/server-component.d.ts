// packages/ssr/src/server-component.ts
//
// FEATURE (v0.4.0): Server Components — کامپوننت‌هایی که کاملاً در سرور
// رندر می‌شوند و در کلاینت hydrate نمی‌شوند. این مزیت بزرگ Zenith نسبت
// به React است: HTML-First بودن به‌طور ذاتی از Server Components پشتیبانی
// می‌کند بدون نیاز به JSX یا Virtual DOM.
/**
 * یک Server Component.
 *
 * @property name   نام یکتای کامپوننت (در registry).
 * @property render تابعی که props می‌گیرد و HTML برمی‌گرداند.
 *                  می‌تواند async باشد (مثلاً برای fetch داده از DB).
 */
export interface ServerComponent {
    readonly name: string;
    render: (props: Record<string, any>) => Promise<string> | string;
}
/**
 * ثبت یک Server Component در registry.
 * اگر قبلاً با همین نام ثبت شده، overwrite می‌شود (برای HMR مفید است).
 *
 * @throws اگر comp نامعتبر باشد (بدون name یا render).
 */
export declare function registerServerComponent(comp: ServerComponent): void;
/**
 * گرفتن یک Server Component از registry.
 * اگر وجود نداشت، undefined برمی‌گرداند.
 */
export declare function getServerComponent(name: string): ServerComponent | undefined;
/**
 * حذف یک Server Component از registry.
 * برای تست‌ها و HMR.
 *
 * @returns true اگر حذف شد، false اگر وجود نداشت.
 */
export declare function unregisterServerComponent(name: string): boolean;
/**
 * پاکسازی کل registry.
 * عمدتاً برای تست‌ها.
 */
export declare function clearServerComponents(): void;
/**
 * نام markerهای اطراف HTML رندرشده‌ی یک Server Component.
 *
 *   OPEN:  <!--zenith-server-component:NAME-->
 *   CLOSE: <!--/zenith-server-component:NAME-->
 *
 * این فرمت برای hydrate قابل parse است و نام کامپوننت را هم ذخیره
 * می‌کند (برای debug و DevTools).
 */
export declare const SERVER_COMPONENT_OPEN_PREFIX = "zenith-server-component:";
export declare const SERVER_COMPONENT_CLOSE_PREFIX = "/zenith-server-component:";
/**
 * ساخت marker comment بازشونده.
 */
export declare function makeOpenMarker(name: string): string;
/**
 * ساخت marker comment بست‌شونده.
 */
export declare function makeCloseMarker(name: string): string;
/**
 * رندر یک Server Component با نام و props داده‌شده.
 *
 * HTML خروجی با marker comments احاطه می‌شود تا hydrate بداند آن را رد کند.
 *
 * اگر کامپوننت ثبت نشده باشد، یک کامنت خطا رندر می‌شود (تا صفحه خراب
 * نشود و در DevTools مشخص باشد چه چیزی اشتباه است).
 *
 * اگر render خطا دهد، یک کامنت خطا رندر می‌شود.
 *
 * @param name   نام کامپوننت در registry.
 * @param props  Props پاس‌داده‌شده به render().
 * @returns HTML شامل marker comments.
 */
export declare function renderServerComponent(name: string, props?: Record<string, any>): Promise<string>;
/**
 * Factory helper برای تعریف یک Server Component با type safety.
 *
 * استفاده:
 *   const Markdown = defineServerComponent('markdown', async (props) => {
 *     return `<div class="markdown">${props.content}</div>`;
 *   });
 *   registerServerComponent(Markdown);
 *
 * یا به‌صورت inline:
 *   registerServerComponent(defineServerComponent('header', (p) => `<h1>${p.title}</h1>`));
 *
 * @param name   نام کامپوننت.
 * @param render تابع رندر.
 */
export declare function defineServerComponent(name: string, render: (props: Record<string, any>) => Promise<string> | string): ServerComponent;
/**
 * پیدا کردن تمام تگ‌های <zen-server-component> در HTML و جایگزینی
 * آن‌ها با HTML رندرشده‌ی کامپوننت.
 *
 * این تابع async است چون render ممکن است async باشد. تمام کامپوننت‌ها
 * به‌صورت موازی (Promise.all) رندر می‌شوند تا latency کاهش یابد.
 *
 * @param html   HTML ورودی.
 * @param state  آبجکت state برای resolve کردن $ expressions در props.
 * @returns HTML با تگ‌های جایگزین‌شده. اگر تگی پیدا نشود، html اصلی
 *          بدون تغییر برگردانده می‌شود.
 */
export declare function inlineServerComponents(html: string, state?: Record<string, any>): Promise<string>;
//# sourceMappingURL=server-component.d.ts.map
