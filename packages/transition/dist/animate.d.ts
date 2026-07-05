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
export declare const ANIMATE_PRESETS: Record<string, Keyframe[]>;
/**
 * نتیجه‌ی parse کردن مقدار attribute `zen-animate`.
 */
export interface ParsedAnimateAttr {
    /** نام پیش‌تنظیم (مثل 'slideUp'). */
    preset: string;
    /** آرایه‌ی Keyframeهای متناظر با preset (از ANIMATE_PRESETS). */
    keyframes: Keyframe[];
    /** گزینه‌های KeyframeAnimationOptions استخراج‌شده از بخش‌های key:value. */
    options: KeyframeAnimationOptions;
}
/**
 * اجرای یک انیمیشن Web Animations API روی یک عنصر.
 *
 * @param el       عنصر هدف.
 * @param keyframes آرایه‌ی Keyframeها.
 * @param options  گزینه‌های KeyframeAnimationOptions (duration, easing, …).
 * @returns Promise‌ای که بعد از پایان (یا لغو) انیمیشن resolve می‌شود.
 */
export declare function zenAnimate(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void>;
/**
 * Parse مقدار attribute `zen-animate`.
 *
 * @param value مقدار attribute.
 * @returns شیء شامل preset، keyframes و options.
 * @throws Error اگر preset در ANIMATE_PRESETS نباشد.
 */
export declare function parseAnimateAttr(value: string): ParsedAnimateAttr;
/**
 * Directive processor برای `zen-animate`.
 *
 * @param el        عنصر HTML.
 * @param attrValue مقدار attribute `zen-animate`.
 * @param _context  Context (در حال حاضر استفاده‌ای ندارد ولی برای یکپارچگی
 *                  با signature سایر directive processors نگه داشته شده).
 * @returns تابع Dispose (no-op).
 */
export declare function processAnimate(el: HTMLElement, attrValue: string, _context?: Record<string, any>): () => void;
//# sourceMappingURL=animate.d.ts.map
