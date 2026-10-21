// packages/transition/src/transition-core.ts
//
// کنترلر createTransition — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).

import { prefersReducedMotion } from './animate';
import { DEFAULT_CLASSES, classTokens, measureTransitionDuration, addClasses, removeClasses } from './transition-classes';
import type { TransitionDirection, TransitionClasses, TransitionOptions, TransitionRun, TransitionController } from './transition-types';


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
  const versions = new WeakMap<HTMLElement, number>(); let sequence = 0;
  const duration = options.duration ?? 300;
  let disposed = false;

  const createCompletedRun = (): TransitionRun => ({
    finished: Promise.resolve(),
    cancel: () => {},
  });

  function run(element: HTMLElement, direction: TransitionDirection): TransitionRun {
    if (disposed) return createCompletedRun();

    const version = ++sequence; versions.set(element, version);
    activeRuns.get(element)?.cancel();

    if (direction === 'enter') options.onBeforeEnter?.(element);
    else options.onBeforeLeave?.(element);

    // #133: اگر کاربر prefers-reduced-motion را فعال کرده باشد، از اجرای
    // transition حرکتی صرف‌نظر می‌کنیم ولی تمام callbackها را بلافاصله فراخوانی می‌کنیم.
    if (disposed || versions.get(element) !== version) return createCompletedRun();
    const view = element.ownerDocument.defaultView;
    if (!view || (element.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__ || prefersReducedMotion(element.ownerDocument)) {
      if (direction === 'enter') options.onAfterEnter?.(element);
      else options.onAfterLeave?.(element);
      options.onComplete?.();
      return createCompletedRun();
    }

    const from = direction === 'enter' ? classes.enterFrom : classes.leaveFrom;
    const active = direction === 'enter' ? classes.enterActive : classes.leaveActive;
    const to = direction === 'enter' ? classes.enterTo : classes.leaveTo;
    const hadClassAttribute = element.hasAttribute('class');
    const originalClasses = new Map([...new Set([name, from, active, to].flatMap(classTokens))].map(token => [token, element.classList.contains(token)]));
    const requestFrame = view.requestAnimationFrame?.bind(view) ?? ((callback: FrameRequestCallback) => view.setTimeout(() => callback(Date.now()), 16));
    const cancelFrame = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);

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
      if (raf1) cancelFrame(raf1);
      if (raf2) cancelFrame(raf2);
      if (timer) clearTimeout(timer);
      element.removeEventListener('transitionend', onEnd);
      element.removeEventListener('transitioncancel', onCancel);
      element.removeEventListener('animationend', onEnd);
      element.removeEventListener('animationcancel', onCancel);
      for (const [token, present] of originalClasses) element.classList.toggle(token, present);
      if (!hadClassAttribute && !element.classList.length) element.removeAttribute('class');
      if (activeRuns.get(element) === transitionRun) activeRuns.delete(element);

      try {
        if (completed) {
          if (direction === 'enter') options.onAfterEnter?.(element);
          else options.onAfterLeave?.(element);
          options.onComplete?.();
        }
      } finally { resolveFinished(); }
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
    timer = setTimeout(() => finish(true), Math.min(2147483647, Math.max(0, duration) + 50));

    raf1 = requestFrame(() => {
      if (settled) return;
      raf2 = requestFrame(() => {
        if (settled) return;
        // اطمینان از اعمال شدن state آغازین پیش از تغییر classها.
        void view.getComputedStyle(element).transform; // intentional forced style resolution (reflow)
        if (settled) return;
        removeClasses(element, from);
        addClasses(element, to);

        // FIX (#23): پس از اعمال کلاس مقصد، مدت واقعی طولانی‌ترین
        // transition/animation را از computed style اندازه بگیر و deadline و
        // تایمر fallback را به بیشینهٔ (duration، مدت واقعی) + حاشیه ببر.
        expectedEndMs = measureTransitionDuration(element);
        if (settled) return;
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
