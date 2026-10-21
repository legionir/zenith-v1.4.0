// packages/transition/src/transition-types.ts
//
// تایپ‌های transition — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).


export type TransitionDirection = 'enter' | 'leave';

export interface TransitionClasses {
  /** کلاس حالت آغاز ورود. */
  enterFrom?: string;
  /** کلاس فعال هنگام ورود. */
  enterActive?: string;
  /** کلاس حالت پایان ورود. */
  enterTo?: string;
  /** کلاس حالت آغاز خروج. */
  leaveFrom?: string;
  /** کلاس فعال هنگام خروج. */
  leaveActive?: string;
  /** کلاس حالت پایان خروج. */
  leaveTo?: string;
}

export interface TransitionOptions {
  /** مدت زمان transition به میلی‌ثانیه (پیش‌فرض: 300) — فقط fallback. */
  duration?: number;
  /** نام transition (مثل 'fade'). در createTransition از آرگومان اول گرفته می‌شود. */
  name?: string;
  /** callback سازگاری برای پایان transitionهای قدیمی. */
  onComplete?: () => void;
  /** جایگزین‌های اختیاری برای کلاس‌های پیش‌فرض zen-enter-* و zen-leave-*. */
  classes?: TransitionClasses;
  /** قبل از آغاز transition ورود فراخوانی می‌شود. */
  onBeforeEnter?: (el: HTMLElement) => void;
  /** بعد از تکمیل transition ورود فراخوانی می‌شود. */
  onAfterEnter?: (el: HTMLElement) => void;
  /** قبل از آغاز transition خروج فراخوانی می‌شود. */
  onBeforeLeave?: (el: HTMLElement) => void;
  /** بعد از تکمیل transition خروج فراخوانی می‌شود. */
  onAfterLeave?: (el: HTMLElement) => void;
}

/** نتیجه اجرای یک transition قابل انتظار و قابل لغو. */
export interface TransitionRun {
  /** پس از اتمام طبیعی یا لغو transition resolve می‌شود. */
  readonly finished: Promise<void>;
  /**
   * transition فعال را لغو و کلاس‌های موقت را پاکسازی می‌کند.
   * #116/DEC-032: `cancel` نام *رفتاری* است (لغو یک اجرای در حال انجام)،
   * نه چرخهٔ عمر — خودِ controller متد `dispose()` دارد؛ بنابراین alias
   * `dispose` برای این عضو معنی ندارد و در گیت cleanup-hygiene allowlist شده.
   */
  cancel(): void;
}

/** کنترلر reusable برای اجرای transition روی عناصر متعدد. */
export interface TransitionController {
  /** اجرای transition ورود. */
  enter(element: HTMLElement): TransitionRun;
  /** اجرای transition خروج. */
  leave(element: HTMLElement): TransitionRun;
  /** لغو تمام transitionهای فعال و غیرقابل‌استفاده کردن کنترلر. */
  dispose(): void;
}

// ── Single implementation path (#47) ──
//
// موتور مبنا `createTransition` (کلاس‌محور) است. `enterTransition` /
// `leaveTransition` / `animateGroup` فقط wrapper روی همان موتورند و در dev
// یک‌بار هشدار deprecation با کد ZEN-DEPR-002/003/004 می‌دهند.
// موتور موازی WAAPI در این فایل حذف شده است؛ برای انیمیشن مبتنی بر
// Web Animations API از `zenAnimate`/`processAnimate` (animate.ts) و
// دایرکتیو `zen-animate` استفاده کنید — آن‌ها قابلیت جدا (keyframes جاوااسکریپتی)
// هستند، نه پیاده‌سازی موازی transition کلاس‌محور.

/**
 * @deprecated از createTransition استفاده کنید (ZEN-DEPR-002، #47).
 *
 * وارد کردن یک عنصر با transition (enter). صرفاً wrapper روی موتور کلاس‌محور
 * `createTransition` است: کلاس‌های `name` + `zen-enter-from/active` همزمان،
 * swap به `zen-enter-to` در دو rAF، پایان با transitionend/animationend
 * (هدف‌چک‌شده) یا تایمر fallback، و پاک‌سازی کامل در cancel.
 *
 * @param el عنصری که به DOM اضافه شده.
 * @param name نام transition (مثل 'fade').
 * @param duration مدت زمان fallback به میلی‌ثانیه (پیش‌فرض: 300).
 * @param onComplete callback بعد از پایان transition (پایان موفق).
 * @returns تابع cancel.
 */
export interface LegacyDirectionOptions {
  /** نام transition (مثل 'fade'). */
  name: string;
  /** مدت زمان fallback به میلی‌ثانیه. @default 300 */
  duration?: number;
  /** callback بعد از پایان موفق transition. */
  onComplete?: () => void;
}
