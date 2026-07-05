// packages/runtime/src/directives/portal.ts
//
// FEATURE (v0.5.0): zen-portal — جابجایی یک عنصر به یک container دیگر.
//
// کاربرد:
//   <div zen-portal="body">I'm now at the end of body</div>
//   <div zen-portal="#modal-root">I'm rendered inside #modal-root</div>
//   <dialog zen-portal="$modalTarget">Modal content</dialog>
//
// این دایرکتیو برای مواردی مثل modalها، tooltipها، و notificationها مفید
// است که باید از محل اصلی خود در DOM خارج شوند (مثلاً برای جلوگیری از
// z-index stacking context issues یا overflow:hidden والد) و در یک
// container سراسری (مثل body یا یک #portal-root) رندر شوند.
//
// ── نحوه کار ──
//
//   1) originalParent = el.parentElement را ذخیره می‌کنیم.
//   2) یک Comment placeholder می‌سازیم و عنصر را با آن در originalParent
//      جایگزین می‌کنیم (تا محل اصلی عنصر در DOM حفظ شود).
//   3) target container را با document.querySelector(targetSelector)
//      پیدا می‌کنیم. اگر پیدا نشد یا selector خالی بود، به document.body
//      fallback می‌کنیم.
//   4) عنصر را به target container اضافه می‌کنیم (appendChild).
//
// ── Dispose ──
//
//   در زمان teardown (مثلاً Zen.stop یا zen-if=false)، عنصر باید به
//   محل اصلی خود برگردانده شود. این کار با:
//     ۱) حذف عنصر از target container.
//     ۲) جایگزینی placeholder با عنصر در originalParent.
//   انجام می‌شود.
//
// ── Memory Leak Prevention ──
//
//   walker تابع dispose برگردانده‌شده را در آرایه‌ی disposes نگه می‌دارد
//   و در زمان teardown فراخوانی می‌کند. این تابع placeholder را هم
//   پاکسازی می‌کند تا Comment nodeها در DOM باقی نمانند.
/**
 * پردازش دایرکتیو zen-portal روی یک عنصر.
 *
 * @param el              عنصر HTML (که باید zen-portal داشته باشد).
 * @param targetSelector  Selector برای target container (مثل "body" یا "#modal-root").
 *                        اگر خالی یا نامعتبر باشد، document.body استفاده می‌شود.
 * @param context         آبجکت Context (در v0.5.0 استفاده نمی‌شود اما برای
 *                        آینده (مثلاً resolve کردن expression در selector) نگه داشته شده).
 * @returns تابع Dispose برای پاکسازی.
 */
export function processPortal(el, targetSelector, context = {}) {
    // ── ۱. ذخیره‌ی originalParent ──
    // اگر عنصر parent نداشت (مثلاً detached)، نمی‌توانیم portal کنیم — no-op.
    const originalParent = el.parentElement;
    if (!originalParent) {
        return () => { }; // no-op dispose
    }
    // ── ۲. ساخت Comment placeholder و جایگزینی ──
    // placeholder محل اصلی عنصر را در DOM حفظ می‌کند تا در dispose بتوانیم
    // عنصر را دقیقاً در همان نقطه برگردانیم.
    const placeholder = document.createComment('zen-portal');
    originalParent.replaceChild(placeholder, el);
    // ─ـ ۳. پیدا کردن target container ──
    // اگر selector خالی بود یا querySelector چیزی پیدا نکرد، به body fallback.
    // نکته: typeof document چک نمی‌کنیم چون این دایرکتیو فقط در client اجرا
    // می‌شود (walker در SSR اجرا نمی‌شود). اما برای safety در محیط‌های عجیب
    // (مثل jsdom بدون body) fallback را حفظ می‌کنیم.
    let target = null;
    if (targetSelector && targetSelector.trim().length > 0) {
        try {
            target = document.querySelector(targetSelector.trim());
        }
        catch (_a) {
            // selector نامعتبر (مثلاً syntax error) — به fallback می‌رویم.
            target = null;
        }
    }
    if (!target) {
        target = document.body;
    }
    // ── ۴. انتقال عنصر به target ──
    target.appendChild(el);
    // ── ۵. ساخت dispose ──
    // در teardown: عنصر را از target برمی‌داریم و در originalParent در محل
    // placeholder قرار می‌دهیم. placeholder هم پاکسازی می‌شود.
    return () => {
        // اگر عنصر هنوز در target است، آن را برمی‌داریم.
        if (el.parentNode === target) {
            target.removeChild(el);
        }
        // اگر placeholder هنوز در originalParent است، آن را با عنصر جایگزین می‌کنیم.
        if (placeholder.parentNode === originalParent) {
            originalParent.replaceChild(el, placeholder);
        }
        else {
            // اگر placeholder دیگر در originalParent نبود (مثلاً والد در حین
            // dispose تغییر کرده)، عنصر را در انتهای originalParent قرار می‌دهیم
            // به‌عنوان fallback. این کار гаранти می‌کند که عنصر از دست نمی‌رود.
            try {
                originalParent.appendChild(el);
            }
            catch (_b) {
                // اگر originalParent هم detach شده بود، کاری نمی‌توانیم بکنیم.
            }
        }
    };
}
//# sourceMappingURL=portal.js.map
