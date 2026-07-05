// packages/stateful/src/action-button.ts
//
// FEATURE (v0.6.0): zen-action-button — کامپوننت دکمه‌ی Stateful
// که به‌صورت خودکار loading state را هنگام اجرای async action مدیریت می‌کند.
//
// ── سینتکس ──
//
//   <zen-action-button action="save" loading-text="در حال ذخیره...">
//     ذخیره
//   </zen-action-button>
//
// ─ـ رفتار ─ـ
//
//   ۱) دکمه با label پیش‌فرض (محتوای متنی داخل تگ) نمایش داده می‌شود.
//   ۲) هنگام کلیک، action با نام `action="save"` از Action Registry فراخوانی
//      می‌شود.
//   ۳) اگر action یک Promise برگرداند:
//      - دکمه disabled می‌شود.
//      - متن آن به loading-text تغییر می‌کند.
//      - کلاس `zen-action-loading` به آن اضافه می‌شود.
//      - وقتی Promise resolve یا reject شد، state دکمه به حالت اولیه برمی‌گردد.
//   ۴) اگر action همزمان باشد (Promise برنمی‌گرداند)، دکمه بلافاصله بعد از
//      اجرای action به حالت اولیه برمی‌گردد.
//
// ─ـ نکات ─ـ
//
//   - این کامپوننت از Event Delegation سراسری استفاده نمی‌کند چون نیاز به
//     کنترل دقیق state دکمه دارد. یک click listener محلی attaches می‌کند.
//   - اگر action در Registry ثبت نشده باشد، هشدار می‌دهد و nothing happens.
//   - SSR-safe: بدون document، no-op می‌شود.
//   - خطاهای action به‌صورت خودکار console.error می‌شوند (اما state دکمه
//     به‌درستی restore می‌شود).

import { getAction } from '@zenith/actions';

/**
 * کلاس‌های CSS که در طول loading state روی دکمه اعمال می‌شوند.
 */
const LOADING_CLASS = 'zen-action-loading';

/**
 * کلید non-enumerable برای ذخیره‌ی state روی element.
 * از WeakMap به‌جای property مستقیم استفاده می‌کنیم تا memory leak نباشد
 * و GC بتواند دکمه‌های حذف‌شده را پاک کند.
 */
const buttonStates = new WeakMap();

/**
 * پردازشگر دایرکتیو zen-action-button.
 *
 * این تابع توسط walker (از طریق custom directive registry) فراخوانی
 * می‌شود.
 *
 * @param el         عنصر <zen-action-button>.
 * @param configAttr مقدار attribute `action` (نام اکشن).
 * @param context    Context والد (در این کامپوننت استفاده نمی‌شود اما برای
 *                   یکنواختی با سایر کامپوننت‌ها پذیرفته می‌شود).
 * @param state      State اصلی (برای پاس دادن به ActionContext).
 * @returns تابع Dispose.
 */
export function processActionButton(el, configAttr, _context, state) {
    // SSR-safe guard.
    if (typeof document === 'undefined') {
        return () => { };
    }
    // ── ۱. اعتبارسنجی action attribute ──
    if (!configAttr || configAttr.trim().length === 0) {
        console.warn('[zen-action-button] Missing or empty `action` attribute.');
        return () => { };
    }
    const actionName = configAttr.trim();
    // ── ۲. خواندن loading-text ──
    const loadingText = el.getAttribute('loading-text') || '...';
    // ── ۳. ذخیره‌ی state اولیه ──
    // متن پیش‌فرض دکمه همان textContent اولیه‌ی آن است.
    buttonStates.set(el, {
        defaultText: el.textContent || '',
        isLoading: false,
    });
    // ── ۴. اطمینان از اینکه element یک <button> است ──
    // اگر کاربر تگ را به‌صورت <zen-action-button> نوشته، آن را به <button>
    // تبدیل نمی‌کنیم (تا قابلیت‌های سفارشی حفظ شود) اما ویژگی‌های button
    // را روی آن set می‌کنیم تا از نظر accessibility درست باشد.
    if (el.tagName.toLowerCase() !== 'button') {
        // برای تگ‌های غیر button، role=button می‌گذاریم تا screen readerها
        // آن را به‌عنوان دکمه بشناسند.
        if (!el.getAttribute('role')) {
            el.setAttribute('role', 'button');
        }
        // tabIndex=0 تا با keyboard focusable باشد.
        if (!el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex', '0');
        }
    }
    // type=button (پیش‌فرض HTML برای <button> داخل form می‌تواند submit باشد
    // که مطلوب ما نیست).
    if (el.tagName.toLowerCase() === 'button' && !el.hasAttribute('type')) {
        el.setAttribute('type', 'button');
    }
    /**
     * تنظیم حالت loading دکمه.
     */
    function setLoading(loading) {
        const st = buttonStates.get(el);
        if (!st)
            return;
        st.isLoading = loading;
        if (loading) {
            el.classList.add(LOADING_CLASS);
            // disabled فقط روی <button> واقعی کار می‌کند. برای تگ‌های سفارشی،
            // از aria-disabled استفاده می‌کنیم.
            if (el.tagName.toLowerCase() === 'button') {
                el.disabled = true;
            }
            else {
                el.setAttribute('aria-disabled', 'true');
            }
            el.textContent = loadingText;
        }
        else {
            el.classList.remove(LOADING_CLASS);
            if (el.tagName.toLowerCase() === 'button') {
                el.disabled = false;
            }
            else {
                el.removeAttribute('aria-disabled');
            }
            el.textContent = st.defaultText;
        }
    }
    /**
     * اجرای action.
     * اگر action Promise برگرداند، loading state را مدیریت می‌کند.
     */
    async function runAction(event) {
        // اگر در حال loading است، کلیک‌های بعدی را ignore کن.
        const st = buttonStates.get(el);
        if (!st || st.isLoading)
            return;
        // دریافت action از registry.
        const actionFn = getAction(actionName);
        if (!actionFn) {
            console.warn(`[zen-action-button] Action "${actionName}" is not registered. ` +
                `Register it with: Zen.action('${actionName}', (ctx) => { ... });`);
            return;
        }
        // فراخوانی action با ActionContext استاندارد.
        setLoading(true);
        try {
            const result = actionFn({
                event,
                state: state || {},
                element: el,
            });
            // اگر action یک Promise برگرداند، صبر کن تا کامل شود.
            if (result && typeof result.then === 'function') {
                await result;
            }
        }
        catch (err) {
            console.error(`[zen-action-button] Action "${actionName}" threw an error:`, err);
        }
        finally {
            setLoading(false);
        }
    }
    // ── ۵. attach click listener ──
    const onClick = (event) => {
        // جلوگیری از action پیش‌فرض (مثلاً submit فرم) چون ما خودمان action را
        // مدیریت می‌کنیم.
        event.preventDefault();
        // stopPropagation تا Event Delegation سراسری هم این کلیک را دوباره
        // handle نکند (که می‌تواند منجر به double-execution شود اگر کاربر
        // zen-action هم روی دکمه گذاشته باشد).
        event.stopPropagation();
        void runAction(event);
    };
    el.addEventListener('click', onClick);
    // ── ۶. پشتیبانی از keyboard (Enter / Space) برای تگ‌های غیر button ──
    // دکمه‌های واقعی <button> این رفتار را به‌صورت native دارند.
    if (el.tagName.toLowerCase() !== 'button') {
        const onKeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void runAction(event);
            }
        };
        el.addEventListener('keydown', onKeydown);
        // ── ۷. تابع Dispose ──
        return () => {
            el.removeEventListener('click', onClick);
            el.removeEventListener('keydown', onKeydown);
            // در صورت teardown در حالت loading، state را reset کن.
            setLoading(false);
            buttonStates.delete(el);
        };
    }
    // ── ۷. تابع Dispose (برای <button> واقعی) ──
    return () => {
        el.removeEventListener('click', onClick);
        // در صورت teardown در حالت loading، state را reset کن.
        setLoading(false);
        buttonStates.delete(el);
    };
}
//# sourceMappingURL=action-button.js.map
