// packages/transition/src/transition-animate.ts
//
// animate و helperهای جهت — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { createTransition } from './transition-core';
import { validateEasing } from './transition-group';
import type { TransitionRun, AnimateCallOptions, AnimateDirectionOptions } from './transition-types';



// ── #55: Options-object signatures for animate / animateEnter / animateLeave ──

export interface AnimateCallOptions {
  keyframes: Keyframe[];
  duration?: number;
  easing?: string;
  delay?: number;
  fill?: FillMode;
  onFinish?: () => void;
}

export interface AnimateDirectionOptions {
  name?: string;
  duration?: number;
  easing?: string;
  onFinish?: () => void;
}

/**
 * Run a WAAPI animation on `el` using an options object (#55).
 */
export function animate(el: HTMLElement, options: AnimateCallOptions): Promise<void>;
/**
 * @deprecated Use `animate(el, { keyframes, duration, easing, delay, fill, onFinish })` (#55, ZEN-DEPR-039).
 */
export function animate(
  el: HTMLElement,
  keyframes: Keyframe[],
  duration?: number,
  easing?: string,
  delay?: number,
  fill?: FillMode,
  onFinish?: () => void,
): Promise<void>;
export function animate(
  el: HTMLElement,
  keyframesOrOptions: Keyframe[] | AnimateCallOptions,
  legacyDuration?: number,
  legacyEasing?: string,
  legacyDelay?: number,
  legacyFill?: FillMode,
  legacyOnFinish?: () => void,
): Promise<void> {
  let opts: AnimateCallOptions;
  if (Array.isArray(keyframesOrOptions)) {
    deprecate(
      'ZEN-DEPR-039',
      'animate(el, keyframes, duration, easing, delay, fill, onFinish)',
      'animate(el, { keyframes, duration, easing, delay, fill, onFinish })',
    );
    opts = {
      keyframes: keyframesOrOptions,
      duration: legacyDuration,
      easing: legacyEasing,
      delay: legacyDelay,
      fill: legacyFill,
      onFinish: legacyOnFinish,
    };
  } else {
    opts = keyframesOrOptions;
  }

  if (typeof el.animate !== 'function') {
    opts.onFinish?.();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const anim = el.animate(opts.keyframes, {
      duration: opts.duration ?? 300,
      easing: validateEasing(opts.easing ?? 'ease'),
      delay: opts.delay ?? 0,
      fill: opts.fill ?? 'forwards',
    });
    anim.onfinish = () => {
      try {
        anim.commitStyles();
      } catch {
        /* ignore */
      }
      anim.cancel();
      opts.onFinish?.();
      resolve();
    };
    anim.oncancel = () => resolve();
  });
}

/**
 * Run an enter transition on `el` using an options object (#55).
 */
export function animateEnter(el: HTMLElement, options?: AnimateDirectionOptions): TransitionRun;
/**
 * @deprecated Use `animateEnter(el, { name, duration, easing, onFinish })` (#55, ZEN-DEPR-040).
 */
export function animateEnter(
  el: HTMLElement,
  name: string,
  duration?: number,
  easing?: string,
  onFinish?: () => void,
): TransitionRun;
export function animateEnter(
  el: HTMLElement,
  nameOrOptions?: string | AnimateDirectionOptions,
  legacyDuration?: number,
  _legacyEasing?: string,
  legacyOnFinish?: () => void,
): TransitionRun {
  let opts: AnimateDirectionOptions;
  if (typeof nameOrOptions === 'string') {
    deprecate(
      'ZEN-DEPR-040',
      'animateEnter(el, name, duration, easing, onFinish)',
      'animateEnter(el, { name, duration, easing, onFinish })',
    );
    opts = {
      name: nameOrOptions,
      duration: legacyDuration,
      onFinish: legacyOnFinish,
    };
  } else {
    opts = nameOrOptions ?? {};
  }
  const controller = createTransition(opts.name ?? 'fade', {
    duration: opts.duration ?? 300,
    onAfterEnter: () => opts.onFinish?.(),
  });
  return controller.enter(el);
}

/**
 * Run a leave transition on `el` using an options object (#55).
 */
export function animateLeave(el: HTMLElement, options?: AnimateDirectionOptions): TransitionRun;
/**
 * @deprecated Use `animateLeave(el, { name, duration, easing, onFinish })` (#55, ZEN-DEPR-041).
 */
export function animateLeave(
  el: HTMLElement,
  name: string,
  duration?: number,
  easing?: string,
  onFinish?: () => void,
): TransitionRun;
export function animateLeave(
  el: HTMLElement,
  nameOrOptions?: string | AnimateDirectionOptions,
  legacyDuration?: number,
  _legacyEasing?: string,
  legacyOnFinish?: () => void,
): TransitionRun {
  let opts: AnimateDirectionOptions;
  if (typeof nameOrOptions === 'string') {
    deprecate(
      'ZEN-DEPR-041',
      'animateLeave(el, name, duration, easing, onFinish)',
      'animateLeave(el, { name, duration, easing, onFinish })',
    );
    opts = {
      name: nameOrOptions,
      duration: legacyDuration,
      onFinish: legacyOnFinish,
    };
  } else {
    opts = nameOrOptions ?? {};
  }
  const controller = createTransition(opts.name ?? 'fade', {
    duration: opts.duration ?? 300,
    onAfterLeave: () => opts.onFinish?.(),
  });
  return controller.leave(el);
}

/**
 * #133: اجرای انتقال بین دو صفحهٔ مسیریاب (`mode: 'out-in' | 'in-out'`) با رعایت `prefersReducedMotion`.
 */
export async function runRouteTransition(
  outEl: HTMLElement | null,
  inEl: HTMLElement | null,
  options: { name?: string; duration?: number; mode?: 'out-in' | 'in-out' } = {},
): Promise<void> {
  const { name = 'fade', duration = 200, mode = 'out-in' } = options;
  const controller = createTransition(name, { duration });
  try {
    if (mode === 'out-in') {
      if (outEl) {
        await controller.leave(outEl).finished;
        outEl.remove();
      }
      if (inEl) {
        await controller.enter(inEl).finished;
      }
    } else {
      const promises: Promise<void>[] = [];
      if (inEl) promises.push(controller.enter(inEl).finished);
      if (outEl) {
        promises.push(
          controller.leave(outEl).finished.then(() => {
            outEl.remove();
          }),
        );
      }
      await Promise.all(promises);
    }
  } finally {
    controller.dispose();
  }
}
