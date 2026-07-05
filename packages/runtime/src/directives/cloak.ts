// packages/runtime/src/directives/cloak.ts
//
// FEATURE (v0.5.0): zen-cloak — جلوگیری از Flash of Unstyled Content (FOUC).
//
// کاربرد:
//   <style>[zen-cloak] { display: none; }</style>
//   <div zen-cloak zen-text="$user.name">...</div>
//
// ── مسئله ──
//
//   وقتی Zen.start فراخوانی می‌شود، browser ممکن است HTML خام را قبل از
//   اینکه دایرکتیوها پردازش شوند، paint کند. این یعنی کاربر برای یک لحظه
//   محتوای پردازش‌نشده می‌بیند:
//     - عبارت‌های "$user.name" به‌جای مقدار واقعی.
//     - عناصر zen-if که باید hidden باشند اما هنوز visible‌اند.
//     - لیست‌های zen-for که هنوز رندر نشده‌اند.
//
//   این پدیده "FOUC" یا "Flash of Unstyled Content" نامیده می‌شود.
//
// ── راه‌حل ──
//
//   1) کاربر در CSS خود می‌نویسد:
//        [zen-cloak] { display: none; }
//   2) هر عنصری که نباید قبل از hydration دیده شود، zen-cloak می‌گیرد.
//   3) وقتی walker به عنصر می‌رسد و دایرکتیوهای آن را پردازش کرد،
//      processCloak صدا می‌خورد و zen-cloak attribute را پاک می‌کند.
//      با حذف attribute، selector CSS دیگر match نمی‌کند و عنصر visible
//      می‌شود.
//
//   نتیجه: کاربر فقط محتوای پردازش‌شده را می‌بیند.
//
// ── ترتیب در walker ──
//
//   processCloak باید **آخرین** دایرکتیوی باشد که روی یک عنصر اجرا می‌شود
//   (بعد از zen-text، zen-bind، zen-if، و غیره). وگرنه عنصر برای یک لحظه
//   visible می‌شود و سپس دوباره hidden می‌شود که باعث flicker می‌شود.
//
//   در walker.ts، processCloak در انتهای processNodeDirectives فراخوانی
//   می‌شود تا این ترتیب حفظ شود.
//
// ── Dispose ──
//
//   این دایرکتیو Effect ایجاد نمی‌کند — فقط یک attribute را حذف می‌کند.
//   بنابراین dispose یک no-op است. اما برای یکنواختی با سایر دایرکتیوها،
//   یک تابع خالی برمی‌گردانیم تا walker بتواند آن را در آرایه‌ی disposes
//   قرار دهد بدون اینکه type-check شکست بخورد.

/**
 * پردازش دایرکتیو zen-cloak روی یک عنصر.
 *
 * فقط attribute `zen-cloak` را حذف می‌کند تا CSS `[zen-cloak] { display: none; }`
 * دیگر اعمال نشود و عنصر visible شود.
 *
 * @param el عنصر HTML (که باید zen-cloak داشته باشد).
 * @returns تابع Dispose (no-op — این دایرکتیو Effect ندارد).
 */
export function processCloak(el: HTMLElement): () => void {
  // FEATURE (v0.5.0): zen-cloak — حذف attribute برای visible شدن عنصر.
  el.removeAttribute('zen-cloak');

  // no-op dispose — این دایرکتیو Effect یا listener ندارد که پاکسازی شود.
  return () => {};
}
