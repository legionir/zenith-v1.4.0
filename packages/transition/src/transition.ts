// packages/transition/src/transition.ts
//
// Transition/Animation — قابلیت غایب فاز ۹ (فاز ۱۱).
//
// این ماژول enter/leave animations را برای zen-if و zen-for فراهم می‌کند.
//
// ── سینتکس ──
// <div zen-if="$show" zen-transition="fade">
//   محتوا
// </div>
//
// ── نحوه کار ─ـ
// وقتی zen-if=true (enter):
// 1) عنصر به DOM اضافه می‌شود.
// 2) کلاس `zen-enter-from` اضافه می‌شود.
// 3) در فریم بعدی، `zen-enter-from` حذف و `zen-enter-to` اضافه می‌شود.
// 4) بعد از پایان transition، `zen-enter-to` حذف می‌شود.
//
// وقتی zen-if=false (leave):
// 1) کلاس `zen-leave-from` اضافه می‌شود.
// 2) در فریم بعدی، `zen-leave-from` حذف و `zen-leave-to` اضافه می‌شود.
// 3) بعد از پایان transition، عنصر از DOM حذف می‌شود.
//
// ── CSS ─ـ
// کاربر باید CSS های زیر را تعریف کند:
// .fade.zen-enter-from { opacity: 0; }
// .fade.zen-enter-to { opacity: 1; transition: opacity 0.3s; }
// .fade.zen-leave-from { opacity: 1; }
// .fade.zen-leave-to { opacity: 0; transition: opacity 0.3s; }

const ENTER_FROM = 'zen-enter-from';
const ENTER_TO = 'zen-enter-to';
const LEAVE_FROM = 'zen-leave-from';
const LEAVE_TO = 'zen-leave-to';
const ENTER_ACTIVE = 'zen-enter-active';
const LEAVE_ACTIVE = 'zen-leave-active';

// #47: هشدار deprecation یک‌باره با کد ZEN-DEPR-xxx (سیاست #58).
import { deprecate } from '@zenith/errors';

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
  /** transition فعال را لغو و کلاس‌های موقت را پاکسازی می‌کند. */
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
export function enterTransition(
  el: HTMLElement,
  name: string,
  duration: number = 300,
  onComplete?: () => void,
): () => void {
  return runLegacyDirection(el, name, 'enter', duration, onComplete);
}

/**
 * @deprecated از createTransition استفاده کنید (ZEN-DEPR-003، #47).
 *
 * خروج یک عنصر با transition (leave) — wrapper روی موتور مبنا.
 */
export function leaveTransition(
  el: HTMLElement,
  name: string,
  duration: number = 300,
  onComplete?: () => void,
): () => void {
  return runLegacyDirection(el, name, 'leave', duration, onComplete);
}

/** پیاده‌سازی مشترک wrapperهای enter/leave روی createTransition (#47). */
function runLegacyDirection(
  el: HTMLElement,
  name: string,
  direction: TransitionDirection,
  duration: number,
  onComplete?: () => void,
): () => void {
  deprecate(
    direction === 'enter' ? 'ZEN-DEPR-002' : 'ZEN-DEPR-003',
    direction === 'enter' ? 'enterTransition' : 'leaveTransition',
    'createTransition(name, { duration, ... }).enter(el) / .leave(el)',
  );
  const controller = createTransition(name, {
    duration,
    onComplete: () => onComplete?.(),
  });
  const run = direction === 'enter' ? controller.enter(el) : controller.leave(el);
  return () => {
    run.cancel();
    controller.dispose();
  };
}

/**
 * بررسی اینکه آیا عنصر در حال حاضر در حال transition است.
 */
export function isTransitioning(el: HTMLElement): boolean {
  return el.classList.contains(ENTER_ACTIVE) || el.classList.contains(LEAVE_ACTIVE);
}

/**
 * لغو هر transition فعال روی عنصر و پاکسازی کلاس‌ها.
 */
export function cancelTransition(el: HTMLElement): void {
  el.classList.remove(ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
  el.classList.remove(LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
}

// ── CSS Transition Names ──
export const TRANSITION_NAMES = new Set<string>(['fade', 'slide', 'scale', 'slide-fade']);

/**
 * اعتبارسنجی easing string برای استفاده در CSS transitions / WAAPI.
 *
 * IMP-TRN-02: پشتیبانی از easing سفارشی (cubic-bezier).
 *
 * @param easing رشته easing
 * @returns easing معتبر یا 'ease' پیش‌فرض
 */
export function validateEasing(easing: string): EffectTiming['easing'] {
  const builtin = [
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'step-start',
    'step-end',
  ];
  if (builtin.includes(easing)) return easing;
  if (/^cubic-bezier\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+\)$/.test(easing)) return easing;
  if (/^steps\(\d+,\s*(start|end)\)$/.test(easing)) return easing;
  return 'ease';
}

/**
 * @deprecated از createTransition استفاده کنید (ZEN-DEPR-004، #47).
 *
 * اجرای group transition روی چند عنصر هم‌زمان با تأخیر پلکانی.
 * روی موتور مبنا (`createTransition`) پیاده شده است — تنها یک مسیر
 * پیاده‌سازی وجود دارد (#47).
 *
 * @param elements آرایه‌ای از عناصر
 * @param direction جهت transition ('enter' | 'leave')
 * @param name نام transition
 * @param duration مدت زمان به میلی‌ثانیه
 * @param staggerDelay تأخیر بین هر عنصر به میلی‌ثانیه (پیش‌فرض: 50)
 * @returns Promise که بعد از پایان همه transitionها resolve می‌شود
 */
export function animateGroup(
  elements: HTMLElement[],
  direction: TransitionDirection,
  name: string,
  duration: number = 300,
  staggerDelay: number = 50,
): Promise<void> {
  deprecate('ZEN-DEPR-004', 'animateGroup', 'createTransition(name, { duration })');
  return new Promise((resolve) => {
    let remaining = elements.length;
    if (remaining === 0) {
      resolve();
      return;
    }

    // یک کنترلر مشترک برای همه عناصر — همان موتور createTransition (#47).
    const controller = createTransition(name, { duration });
    const finishOne = () => {
      remaining--;
      if (remaining <= 0) {
        controller.dispose();
        resolve();
      }
    };

    elements.forEach((el, i) => {
      setTimeout(() => {
        if (direction === 'leave' && !document.body.contains(el)) {
          finishOne();
          return;
        }
        const run = direction === 'enter' ? controller.enter(el) : controller.leave(el);
        void run.finished.then(finishOne, finishOne);
      }, i * staggerDelay);
    });
  });
}

const DEFAULT_CLASSES: Required<TransitionClasses> = {
  enterFrom: ENTER_FROM,
  enterActive: ENTER_ACTIVE,
  enterTo: ENTER_TO,
  leaveFrom: LEAVE_FROM,
  leaveActive: LEAVE_ACTIVE,
  leaveTo: LEAVE_TO,
};

function classTokens(className: string): string[] {
  return className.split(/\s+/).filter(Boolean);
}

/**
 * FIX (#23): تبدیل مقدار COMPUTED زمان CSS (مثل "0.5s"/"120ms") به میلی‌ثانیه.
 */
function cssTimeToMs(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed) || 0;
  if (trimmed.endsWith('s')) return (Number.parseFloat(trimmed) || 0) * 1000;
  return Number.parseFloat(trimmed) || 0;
}

/** فهرست‌های CSS (comma-separated) را در computed style به آرایهٔ مقادیر ساده تبدیل می‌کند. */
function cssList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * FIX (#23): مدت واقعی «طولانی‌ترین» transition/animation فعال روی یک عنصر —
 * بیشینهٔ (delay + duration) برای transitionها و
 * (delay + duration × iterations) برای animationها از روی getComputedStyle.
 * infinite/بیش از MAX_ITERATIONS به سقف SAFE_CAP محدود می‌شود تا انتظار
 * نامتناظر createTransition تبدیل به hang نشود.
 */
const MAX_COUNTED_ITERATIONS = 100;
const SAFE_CAP_MS = 30_000;

function measureTransitionDuration(el: HTMLElement): number {
  const style = getComputedStyle(el);
  let longest = 0;

  const tProps = cssList(style.transitionProperty);
  const tDurations = cssList(style.transitionDuration);
  const tDelays = cssList(style.transitionDelay);
  if (!tProps.includes('none')) {
    for (let i = 0; i < Math.max(tDurations.length, 1); i++) {
      const duration = cssTimeToMs(tDurations[i % tDurations.length!] ?? '0s');
      const delay = cssTimeToMs(tDelays[i % Math.max(tDelays.length, 1)] ?? '0s');
      longest = Math.max(longest, delay + duration);
    }
  }

  const aNames = cssList(style.animationName);
  if (!aNames.includes('none')) {
    const aDurations = cssList(style.animationDuration);
    const aDelays = cssList(style.animationDelay);
    const aCounts = cssList(style.animationIterationCount);
    for (let i = 0; i < aNames.length; i++) {
      const duration = cssTimeToMs(aDurations[i % aDurations.length!] ?? '0s');
      const delay = cssTimeToMs(aDelays[i % Math.max(aDelays.length, 1)] ?? '0s');
      const countRaw = (aCounts[i % Math.max(aCounts.length, 1)] ?? '1').trim();
      const iterations =
        countRaw === 'infinite' ? MAX_COUNTED_ITERATIONS : Number.parseFloat(countRaw) || 1;
      longest = Math.max(longest, delay + duration * Math.min(iterations, MAX_COUNTED_ITERATIONS));
    }
  }

  return Math.min(longest, SAFE_CAP_MS);
}

function addClasses(el: HTMLElement, className: string): void {
  el.classList.add(...classTokens(className));
}

function removeClasses(el: HTMLElement, className: string): void {
  el.classList.remove(...classTokens(className));
}

/**
 * ساخت یک کنترلر transition قابل استفاده مجدد.
 *
 * کنترلر عمداً از classهای CSS استفاده می‌کند، تا classهای سفارشی و CSS
 * برنامه قابل پیش‌بینی باشند. `zenAnimate` برای animationهای WAAPI در دسترس
 * است و مسئولیت متفاوتی دارد.
 */
export function createTransition(
  name: string,
  options: TransitionOptions = {},
): TransitionController {
  const classes: Required<TransitionClasses> = {
    ...DEFAULT_CLASSES,
    ...options.classes,
  };
  const activeRuns = new Map<HTMLElement, TransitionRun>();
  const duration = options.duration ?? 300;
  let disposed = false;

  const createCompletedRun = (): TransitionRun => ({
    finished: Promise.resolve(),
    cancel: () => {},
  });

  function run(element: HTMLElement, direction: TransitionDirection): TransitionRun {
    if (disposed) return createCompletedRun();

    activeRuns.get(element)?.cancel();

    if (direction === 'enter') options.onBeforeEnter?.(element);
    else options.onBeforeLeave?.(element);

    const from = direction === 'enter' ? classes.enterFrom : classes.leaveFrom;
    const active = direction === 'enter' ? classes.enterActive : classes.leaveActive;
    const to = direction === 'enter' ? classes.enterTo : classes.leaveTo;

    let settled = false;
    let resolveFinished!: () => void;
    let raf1 = 0;
    let raf2 = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // FIX (#23): مدت واقعیِ طولانی‌ترین transition/animation (از computed
    // style)؛ 0 یعنی «قابل‌اندازه‌گیری نیست» و duration تنظیم‌شده fallback می‌ماند.
    let expectedEndMs = 0;
    // برای تمدید تایمر fallback بر حسب زمان دیواری صرف‌شده از شروع run.
    const startedAt = Date.now();

    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (timer) clearTimeout(timer);
      element.removeEventListener('transitionend', onEnd);
      element.removeEventListener('transitioncancel', onCancel);
      element.removeEventListener('animationend', onEnd);
      element.removeEventListener('animationcancel', onCancel);
      removeClasses(element, from);
      removeClasses(element, active);
      removeClasses(element, to);
      removeClasses(element, name);
      activeRuns.delete(element);

      if (completed) {
        if (direction === 'enter') options.onAfterEnter?.(element);
        else options.onAfterLeave?.(element);
        options.onComplete?.();
      }
      resolveFinished();
    };

    const onEnd = (event: Event) => {
      // FIX (#23): فقط رویداد خودِ المان؛ رویدادهای bubbleشده از فرزندان
      // نباید پایان transition باشند.
      if (event.target !== element) return;
      // FIX (#23): پایان زودهنگام ممنوع — رویدادی که elapsedTime آن کوتاه‌تر
      // از طولانی‌ترین duration محاسبه‌شده است (مثل opacity 0.1s وقتی
      // transform تا 0.5s انیمیت می‌شود) run را تمام نمی‌کند؛ deadline و
      // تایمر fallback تصمیم نهایی را می‌گیرند.
      const elapsed = (event as TransitionEvent | AnimationEvent).elapsedTime ?? 0; // ثانیه
      if (expectedEndMs > 0 && elapsed * 1000 < expectedEndMs) return;
      finish(true);
    };
    const onCancel = (event: Event) => {
      if (event.target === element) finish(false);
    };

    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const transitionRun: TransitionRun = {
      finished,
      cancel: () => finish(false),
    };
    activeRuns.set(element, transitionRun);

    addClasses(element, name);
    addClasses(element, from);
    addClasses(element, active);

    // FIX (#23): گوش‌دادن به رویدادها از همان ابتدا (پیش از rAF) تا رویدادی
    // از دست نرود؛ target-check و deadline مانع پایان زودهنگام می‌شوند.
    element.addEventListener('transitionend', onEnd);
    element.addEventListener('transitioncancel', onCancel);
    element.addEventListener('animationend', onEnd);
    element.addEventListener('animationcancel', onCancel);

    // FIX (#24): تایمر fallback بلافاصله ساخته می‌شود، نه بعد از دو rAF —
    // در تب پس‌زمینه rAF متوقف است وگرنه finished هرگز resolve نمی‌شود.
    // مدت = بیشینهٔ duration تنظیم‌شده و مدت محاسبه‌شده (تقریب اولیه) + حاشیه ۵۰ms.
    timer = setTimeout(() => finish(true), duration + 50);

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (settled) return;
        // اطمینان از اعمال شدن state آغازین پیش از تغییر classها.
        void getComputedStyle(element).transform; // intentional forced style resolution (reflow)
        removeClasses(element, from);
        addClasses(element, to);

        // FIX (#23): پس از اعمال کلاس مقصد، مدت واقعی طولانی‌ترین
        // transition/animation را از computed style اندازه بگیر و deadline و
        // تایمر fallback را به بیشینهٔ (duration، مدت واقعی) + حاشیه ببر.
        expectedEndMs = measureTransitionDuration(element);
        if (expectedEndMs > duration) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => finish(true), expectedEndMs + 50 - (Date.now() - startedAt));
        }
      });
    });

    return transitionRun;
  }

  return {
    enter: (element) => run(element, 'enter'),
    leave: (element) => run(element, 'leave'),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const transitionRun of [...activeRuns.values()]) {
        transitionRun.cancel();
      }
      activeRuns.clear();
    },
  };
}
