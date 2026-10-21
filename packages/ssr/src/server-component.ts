// packages/ssr/src/server-component.ts
//
// FEATURE (v0.4.0): Server Components — کامپوننت‌هایی که کاملاً در سرور
// رندر می‌شوند و در کلاینت hydrate نمی‌شوند. این مزیت بزرگ Zenith نسبت
// به React است: HTML-First بودن به‌طور ذاتی از Server Components پشتیبانی
// می‌کند بدون نیاز به JSX یا Virtual DOM.
//
// ── نحوه کار ──
//
//   1. کاربر یک ServerComponent تعریف می‌کند (تابع async که HTML برمی‌گرداند).
//   2. در قالب HTML: <zen-server-component name="x" prop:foo="bar" />
//      یا       <zen-server-component name="x" prop:foo="bar">slot content</zen-server-component>
//   3. در renderToString: pre-pass تمام این تگ‌ها را پیدا می‌کند،
//      comp.render(props) را فراخوانی می‌کند و HTML را جایگزین می‌کند.
//   4. خروجی با marker comments احاطه می‌شود:
//        <!--zenith-server-component:x-->...HTML...<!--/zenith-server-component:x-->
//      این markerها به hydrate می‌گویند که آن زیردرخت را رد کند (static).
//   5. در hydrate: walker وارد این مناطق نمی‌شود چون تمام attributeهای
//      zen-* از عناصر داخل آن پاک شده‌اند.
//
// ─ـ Server-Only ──
//
// این ماژول فقط در سرور استفاده می‌شود. هیچ ارجاعی به `window` یا
// `document` در آن وجود ندارد چون کد render فقط روی سرور اجرا می‌شود.
// در کلاینت، فقط marker comments دیده می‌شوند که توسط hydrate پردازش
// می‌شوند (نه این ماژول).
//
// ── محدودیت‌ها (v0.4.0) ──
//
//   - Nested <zen-server-component> پشتیبانی نمی‌شود. برای nesting،
//     یک کامپوننت باید خودش تگ <zen-server-component> در خروجی render
//     خودش تولید کند و بعد یک inline pass دیگر روی خروجی اعمال شود.
//   - Expressionهای پیچیده در propها (مثل ${a + b}) پشتیبانی نمی‌شود.
//     فقط $key.path برای ارجاع به state پشتیبانی می‌شود.


export type { ServerComponent } from './server-component-types';
export * from './server-component-registry';
export * from './server-component-render';
export * from './server-component-factory';
export { inlineServerComponents } from './server-component-inline';
