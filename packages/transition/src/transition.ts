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

/**
 * وارد کردن یک عنصر با transition (enter).
 *
 * @param el عنصری که به DOM اضافه شده.
 * @param name نام transition (مثل 'fade').
 * @param duration مدت زمان fallback به میلی‌ثانیه (پیش‌فرض: 300).
 * @param onComplete callback بعد از پایان transition.
 * @returns تابع cancel.
 */
export function enterTransition(
  el: HTMLElement,
  name: string,
  duration: number = 300,
  onComplete?: () => void,
): () => void {
  // ── WAAPI-first: اگر مرورگر از Web Animations API پشتیبانی می‌کند،
  // از آن استفاده کن (عملکرد بهتر، cancellation واقعی).
  if (typeof el.animate === 'function') {
    return enterTransitionWAAPI(el, name, duration, onComplete);
  }
  return enterTransitionCSS(el, name, duration, onComplete);
}

/**
 * پیاده‌سازی enter با Web Animations API.
 * مزایا: نیازی به force reflow ندارد، cancellation دقیق، عملکرد بهتر.
 */
function enterTransitionWAAPI(
  el: HTMLElement,
  name: string,
  duration: number,
  onComplete?: () => void,
): () => void {
  let cancelled = false;

  el.classList.add(name);
  el.classList.add(ENTER_FROM);
  el.classList.add(ENTER_ACTIVE);

  const keyframes: Keyframe[] = [
    { opacity: 0, transform: 'translateY(-10px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ];

  const anim = el.animate(keyframes, {
    duration,
    easing: 'ease-out',
    fill: 'forwards',
  });

  anim.onfinish = () => {
    if (cancelled) return;
    try { anim.commitStyles(); } catch { /* noop */ }
    anim.cancel();
    el.classList.remove(name, ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
    onComplete?.();
  };

  anim.oncancel = () => {
    if (!cancelled) {
      // cancellation خارجی (مثلاً display:none) → پاکسازی
      el.classList.remove(name, ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
    }
  };

  return () => {
    if (cancelled) return;
    cancelled = true;
    anim.cancel();
    el.classList.remove(name, ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
  };
}

/**
 * پیاده‌سازی enter با کلاس‌های CSS (fallback برای مرورگرهای قدیمی).
 *
 * BUG FIX (v7.0): double requestAnimationFrame + reflow (getComputedStyle)
 * + گوش دادن به transitionend و transitioncancel (با setTimeout fallback).
 *
 * BUG FIX (BUG-TRN-01): transitionend listener پس از timeout پاک می‌شود.
 * BUG FIX (BUG-TRN-04): transitioncancel نیز مدیریت می‌شود.
 */
function enterTransitionCSS(
  el: HTMLElement,
  name: string,
  duration: number,
  onComplete?: () => void,
): () => void {
  let cancelled = false;
  let raf1 = 0;
  let raf2 = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onEnd: ((e: TransitionEvent) => void) | null = null;
  let onCancel: ((e: TransitionEvent) => void) | null = null;

  el.classList.add(name);
  el.classList.add(ENTER_FROM);
  el.classList.add(ENTER_ACTIVE);

  raf1 = requestAnimationFrame(() => {
    if (cancelled) return;
    raf2 = requestAnimationFrame(() => {
      if (cancelled) return;
      // BUG FIX (v1.3.0, BUG-TRN-02): استفاده از getComputedStyle به‌جای
      // getBoundingClientRect — cheaper force reflow (فقط style resolution).
      getComputedStyle(el).transform;

      el.classList.remove(ENTER_FROM);
      el.classList.add(ENTER_TO);

      let done = false;
      const finish = () => {
        if (done || cancelled) return;
        done = true;
        if (onEnd) el.removeEventListener('transitionend', onEnd);
        if (onCancel) el.removeEventListener('transitioncancel', onCancel);
        if (timer) clearTimeout(timer);
        timer = null;
        el.classList.remove(ENTER_TO);
        el.classList.remove(ENTER_ACTIVE);
        if (!cancelled && onComplete) onComplete();
      };

      onEnd = (e: TransitionEvent) => {
        if (e.target === el) finish();
      };
      onCancel = (_e: TransitionEvent) => {
        // transition توسط مرورگر لغو شد (display:none, etc)
        finish();
      };

      el.addEventListener('transitionend', onEnd);
      el.addEventListener('transitioncancel', onCancel);
      timer = setTimeout(finish, duration + 50);
    });
  });

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    raf1 = 0; raf2 = 0;
    if (timer) clearTimeout(timer);
    timer = null;
    if (onEnd) el.removeEventListener('transitionend', onEnd);
    if (onCancel) el.removeEventListener('transitioncancel', onCancel);
    onEnd = null;
    onCancel = null;
    el.classList.remove(name, ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
  };
}

/**
 * خروج یک عنصر با transition (leave).
 *
 * @param el عنصری که باید از DOM حذف شود.
 * @param name نام transition.
 * @param duration مدت زمان fallback به میلی‌ثانیه (پیش‌فرض: 300).
 * @param onComplete callback بعد از پایان transition.
 * @returns تابع cancel.
 */
export function leaveTransition(
  el: HTMLElement,
  name: string,
  duration: number = 300,
  onComplete?: () => void,
): () => void {
  if (typeof el.animate === 'function') {
    return leaveTransitionWAAPI(el, name, duration, onComplete);
  }
  return leaveTransitionCSS(el, name, duration, onComplete);
}

/**
 * پیاده‌سازی leave با Web Animations API.
 */
function leaveTransitionWAAPI(
  el: HTMLElement,
  name: string,
  duration: number,
  onComplete?: () => void,
): () => void {
  let cancelled = false;

  el.classList.add(name);
  el.classList.add(LEAVE_FROM);
  el.classList.add(LEAVE_ACTIVE);

  const keyframes: Keyframe[] = [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' },
  ];

  const anim = el.animate(keyframes, {
    duration,
    easing: 'ease-in',
    fill: 'forwards',
  });

  anim.onfinish = () => {
    if (cancelled) return;
    try { anim.commitStyles(); } catch { /* noop */ }
    anim.cancel();
    el.classList.remove(name, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
    onComplete?.();
  };

  anim.oncancel = () => {
    if (!cancelled) {
      el.classList.remove(name, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
    }
  };

  return () => {
    if (cancelled) return;
    cancelled = true;
    anim.cancel();
    el.classList.remove(name, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
  };
}

/**
 * پیاده‌سازی leave با کلاس‌های CSS (fallback).
 */
function leaveTransitionCSS(
  el: HTMLElement,
  name: string,
  duration: number,
  onComplete?: () => void,
): () => void {
  let cancelled = false;
  let raf1 = 0;
  let raf2 = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onEnd: ((e: TransitionEvent) => void) | null = null;
  let onCancel: ((e: TransitionEvent) => void) | null = null;

  el.classList.add(name);
  el.classList.add(LEAVE_FROM);
  el.classList.add(LEAVE_ACTIVE);

  raf1 = requestAnimationFrame(() => {
    if (cancelled) return;
    raf2 = requestAnimationFrame(() => {
      if (cancelled) return;
      // BUG FIX (v1.3.0): استفاده از getComputedStyle به‌جای getBoundingClientRect
      getComputedStyle(el).transform;

      el.classList.remove(LEAVE_FROM);
      el.classList.add(LEAVE_TO);

      let done = false;
      const finish = () => {
        if (done || cancelled) return;
        done = true;
        if (onEnd) el.removeEventListener('transitionend', onEnd);
        if (onCancel) el.removeEventListener('transitioncancel', onCancel);
        if (timer) clearTimeout(timer);
        timer = null;
        el.classList.remove(LEAVE_TO);
        el.classList.remove(LEAVE_ACTIVE);
        if (!cancelled && onComplete) onComplete();
      };

      onEnd = (e: TransitionEvent) => {
        if (e.target === el) finish();
      };
      onCancel = () => finish();

      el.addEventListener('transitionend', onEnd);
      el.addEventListener('transitioncancel', onCancel);
      timer = setTimeout(finish, duration + 50);
    });
  });

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    raf1 = 0; raf2 = 0;
    if (timer) clearTimeout(timer);
    timer = null;
    if (onEnd) el.removeEventListener('transitionend', onEnd);
    if (onCancel) el.removeEventListener('transitioncancel', onCancel);
    onEnd = null;
    onCancel = null;
    el.classList.remove(name, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
  };
}

/**
 * بررسی اینکه آیا عنصر در حال حاضر در حال transition است.
 */
export function isTransitioning(el: HTMLElement): boolean {
  return (
    el.classList.contains(ENTER_ACTIVE) ||
    el.classList.contains(LEAVE_ACTIVE)
  );
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
  const builtin = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'step-start', 'step-end'];
  if (builtin.includes(easing)) return easing;
  if (/^cubic-bezier\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+\)$/.test(easing)) return easing;
  if (/^steps\(\d+,\s*(start|end)\)$/.test(easing)) return easing;
  return 'ease';
}

/**
 * اجرای group transition روی چند عنصر هم‌زمان.
 *
 * IMP-TRN-03: انیمیشن گروهی با delay پلکانی.
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
  return new Promise((resolve) => {
    let remaining = elements.length;
    if (remaining === 0) { resolve(); return; }

    const onDone = () => {
      remaining--;
      if (remaining <= 0) resolve();
    };

    elements.forEach((el, i) => {
      setTimeout(() => {
        const fn = direction === 'enter' ? enterTransition : leaveTransition;
        const cancel = fn(el, name, duration, onDone);
        // اگر تابع cancel بلافاصله صدا زده شود (مثلاً عنصر از DOM حذف شده)
        // باید still resolve کنیم
        if (direction === 'leave' && !document.body.contains(el)) {
          cancel();
          onDone();
        }
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
      if (event.target === element) finish(true);
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

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (settled) return;
        // اطمینان از اعمال شدن state آغازین پیش از تغییر classها.
        getComputedStyle(element).transform;
        removeClasses(element, from);
        addClasses(element, to);
        element.addEventListener('transitionend', onEnd);
        element.addEventListener('transitioncancel', onCancel);
        element.addEventListener('animationend', onEnd);
        element.addEventListener('animationcancel', onCancel);
        timer = setTimeout(() => finish(true), duration + 50);
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
