// packages/transition/src/animate.ts
//
// FEATURE (v0.5.0): zen-animate — انیمیشن مبتنی بر Web Animations API.
//
// برخلاف `transition.ts` که بر اساس کلاس‌های CSS و رویداد `transitionend`
// کار می‌کند، این ماژول از `Element.animate()` (Web Animations API) استفاده
// می‌کند که مزایای زیر را دارد:
//   1) کنترل دقیق‌تر timing با KeyframeEffect و CompositeMode.
//   2) امکان cancellation، reverse، playbackRate بدون تکرار دستی.
//   3) تعیین پایان انیمیشن با `onfinish` (دقیق، بدون setTimeout fallback).
//   4) نیازی به تعریف CSS نیست — keyframes مستقیماً در JS داده می‌شوند.
//   5) SSR-safe: اگر `el.animate` وجود نداشت (Node/ssr/مرورگر قدیمی)،
//      تابع بلافاصله resolve می‌شود و خرابی ایجاد نمی‌کند.
/**
 * مجموعه‌ی پیش‌تنظیم‌های آماده‌ی Keyframe برای zen-animate.
 *
 * هر پیش‌تنظیم یک آرایه از Keyframe است که مستقیماً به `el.animate()` داده
 * می‌شود. نام پیش‌تنظیم در attribute (مثل `zen-animate="slideUp"`) استفاده
 * می‌شود.
 *
 * نکته: مقادیر `transform` رشته‌ای هستند چون Web Animations API رشته‌های
 * transform را قبول می‌کند (نه شیء). مقدار `'none'` برای transform معادل
 * حذف آن است و در پایان انیمیشن، استایل روی مقدار نهایی freeze می‌شود
 * (به‌خاطر `fill: 'forwards'`).
 */
export const ANIMATE_PRESETS = {
    fadeIn: [{ opacity: 0 }, { opacity: 1 }],
    fadeOut: [{ opacity: 1 }, { opacity: 0 }],
    slideUp: [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    slideDown: [{ transform: 'translateY(-20px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    slideLeft: [{ transform: 'translateX(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    slideRight: [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    scaleIn: [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
    scaleOut: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.8)', opacity: 0 }],
    bounce: [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
    shake: [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }],
    rotate: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
};
/**
 * گزینه‌های پیش‌فرض انیمیشن اگر کاربر چیزی در attribute مشخص نکرده باشد.
 *
 * - duration: 300ms (هماهنگ با سیستم transition).
 * - easing: 'ease' (محبوب‌ترین curve).
 * - delay: 0.
 */
const DEFAULT_ANIMATE_OPTIONS = {
    duration: 300,
    easing: 'ease',
    fill: 'forwards',
};
/**
 * اجرای یک انیمیشن Web Animations API روی یک عنصر.
 *
 * این تابع:
 *   1) یک Animation با `el.animate(keyframes, options)` می‌سازد.
 *   2) `fill: 'forwards'` را override می‌کند تا استایل نهایی روی عنصر باقی
 *      بماند.
 *   3) وقتی انیمیشن تمام شد، `commitStyles()` می‌زند تا استایل نهایی به‌صورت
 *      inline style روی عنصر بنشیند (دائمی)، سپس `cancel()` می‌زند تا
 *      Animation از حافظه پاک شود.
 *   4) Promise را resolve می‌کند.
 *
 * SSR/older-browser safety: اگر `el.animate` تابع نبود، Promise فوراً
 * resolve می‌شود تا flow برنامه متوقف نشود.
 *
 * @param el       عنصر هدف.
 * @param keyframes آرایه‌ی Keyframeها.
 * @param options  گزینه‌های KeyframeAnimationOptions (duration, easing, …).
 * @returns Promise‌ای که بعد از پایان (یا لغو) انیمیشن resolve می‌شود.
 */
export function zenAnimate(el, keyframes, options) {
    // SSR / older browser guard: اگر Web Animations API در دسترس نیست، no-op.
    if (typeof el.animate !== 'function') {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        // fill: 'forwards' تضمین می‌کند که استایل آخرین keyframe پس از پایان
        // انیمیشن روی عنصر باقی بماند تا مقادیر نهایی (مثل opacity:1) حفظ شوند.
        const anim = el.animate(keyframes, Object.assign(Object.assign({}, options), { fill: 'forwards' }));
        anim.onfinish = () => {
            // commitStyles استایل نهایی انیمیشن را به‌عنوان inline style روی عنصر
            // ثبت می‌کند تا بعد از cancel حذف نشود. در محیط‌هایی که این متد را
            // ندارند (مثل برخی jsdomها) silently نادیده گرفته می‌شود.
            try {
                anim.commitStyles();
            }
            catch (_a) { }
            // cancel انیمیشن را از lookups مرورگر حذف می‌کند (memory cleanup)
            // بدون اینکه استایل commitشده را بازنشاند.
            anim.cancel();
            resolve();
        };
        anim.oncancel = () => resolve();
    });
}
/**
 * Parse مقدار attribute `zen-animate`.
 *
 * فرمت‌های پشتیبانی‌شده:
 *   - `"slideUp"` — فقط نام preset.
 *   - `"slideUp,duration:500,easing:ease-in"` — preset + گزینه‌ها.
 *   - `"bounce,delay:100,iterations:3"` — با iteration.
 *
 * گزینه‌های قابل تشخیص (همگی به نوع مناسب تبدیل می‌شوند):
 *   - duration     → number (ms)
 *   - delay        → number (ms)
 *   - iterations   → number (Infinity هم پشتیبانی می‌شود)
 *   - direction    → string ('normal' | 'reverse' | 'alternate' | 'alternate-reverse')
 *   - easing       → string (CSS easing مثل 'ease', 'ease-in', 'cubic-bezier(...)')
 *   - endDelay     → number (ms)
 *   - iterationStart → number (0..1)
 *   - playbackRate → number
 *
 * اگر preset ناشناخته باشد، خطا پرتاب می‌شود (با پیام واضح).
 *
 * @param value مقدار attribute.
 * @returns شیء شامل preset، keyframes و options.
 * @throws Error اگر preset در ANIMATE_PRESETS نباشد.
 */
export function parseAnimateAttr(value) {
    // بخش‌بندی با کاما؛ فضای اطراف هر بخش trim می‌شود.
    const parts = value
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    if (parts.length === 0) {
        throw new Error(`[zen-animate] Empty attribute value.`);
    }
    // اولین بخش همیشه نام preset است.
    const preset = parts[0];
    const keyframes = ANIMATE_PRESETS[preset];
    if (!keyframes) {
        throw new Error(`[zen-animate] Unknown preset '${preset}'. ` +
            `Available: ${Object.keys(ANIMATE_PRESETS).join(', ')}.`);
    }
    // بخش‌های بعدی: key:value.
    const options = Object.assign({}, DEFAULT_ANIMATE_OPTIONS);
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) {
            // اگر کلید: مقدار نبود، نادیده بگیر (با warning در Dev).
            if (typeof console !== 'undefined' && console.warn) {
                console.warn(`[zen-animate] Ignoring malformed option '${part}'. Expected 'key:value'.`);
            }
            continue;
        }
        const key = part.slice(0, colonIdx).trim();
        const rawVal = part.slice(colonIdx + 1).trim();
        switch (key) {
            case 'duration':
            case 'delay':
            case 'endDelay':
            case 'playbackRate':
                options[key] = Number(rawVal);
                break;
            case 'iterations':
                // 'Infinity' رشته‌ای هم پشتیبانی شود (loop بی‌نهایت).
                options.iterations = rawVal.toLowerCase() === 'infinity'
                    ? Infinity
                    : Number(rawVal);
                break;
            case 'iterationStart':
                options.iterationStart = Number(rawVal);
                break;
            case 'easing':
            case 'direction':
                options[key] = rawVal;
                break;
            default:
                // کلید ناشناخته — در Dev هشدار بده و نادیده بگیر.
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`[zen-animate] Unknown option '${key}'. Ignoring.`);
                }
                break;
        }
    }
    return { preset, keyframes, options };
}
/**
 * Directive processor برای `zen-animate`.
 *
 * این تابع توسط walker روی هر عنصری که attribute `zen-animate` داشته باشد
 * فراخوانی می‌شود.
 *
 * مراحل:
 *   1) attribute را parse می‌کند (preset + options).
 *   2) keyframes را از ANIMATE_PRESETS برمی‌دارد.
 *   3) zenAnimate(el, keyframes, options) را صدا می‌زند (async، fire-and-forget).
 *   4) attribute را از عنصر حذف می‌کند تا در re-walk دوباره اجرا نشود.
 *   5) یک no-op dispose برمی‌گرداند (انیمیشن خودش را cleanup می‌کند).
 *
 * SSR safety: اگر `el.animate` وجود نداشت، zenAnimate بلافاصله resolve
 * می‌شود و چیزی خراب نمی‌شود.
 *
 * @param el        عنصر HTML.
 * @param attrValue مقدار attribute `zen-animate`.
 * @param _context  Context (در حال حاضر استفاده‌ای ندارد ولی برای یکپارچگی
 *                  با signature سایر directive processors نگه داشته شده).
 * @returns تابع Dispose (no-op).
 */
export function processAnimate(el, attrValue, _context) {
    // حذف attribute برای جلوگیری از re-trigger در walkهای بعدی (مثلاً HMR).
    // این الگو با سایر directiveها (مثل zen-if) یکپارچه است.
    el.removeAttribute('zen-animate');
    // SSR guard زودهنگام: اگر animate در دسترس نیست، اصلاً parse نکن تا هزینه
    // نداشته باشد. (parseAnimateAttr ممکن است throw کند اگر preset نامعتبر باشد؛
    // ولی در SSR بهتر است بی‌صدا نادیده گرفته شود.)
    if (typeof el.animate !== 'function') {
        return () => { };
    }
    let parsed;
    try {
        parsed = parseAnimateAttr(attrValue);
    }
    catch (err) {
        // preset نامعتبر — هشدار و no-op dispose.
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[zen-animate] Failed to parse '${attrValue}':`, err.message);
        }
        return () => { };
    }
    // اجرای انیمیشن به‌صورت fire-and-forget. Promise reject نخواهد شد چون
    // zenAnimate همیشه resolve می‌شود (حتی در صورت cancel).
    void zenAnimate(el, parsed.keyframes, parsed.options);
    // no-op dispose — انیمیشن پس از پایان خودش را با anim.cancel() پاک می‌کند.
    // اگر کاربر بخواهد قبل از پایان آن را لغو کند، می‌تواند از getAnimations()
    // استفاده کند: `el.getAnimations().forEach(a => a.cancel())`.
    return () => { };
}
//# sourceMappingURL=animate.js.map
