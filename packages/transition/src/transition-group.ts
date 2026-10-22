// packages/transition/src/transition-group.ts
//
// نام‌های transition و animateGroup — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { createTransition } from './transition-core';
import type { TransitionDirection } from './transition-types';


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
export interface AnimateGroupOptions {
  /** جهت transition. */
  direction: TransitionDirection;
  /** نام transition. */
  name: string;
  /** مدت زمان به میلی‌ثانیه. @default 300 */
  duration?: number;
  /** تأخیر پلکانی بین عناصر به میلی‌ثانیه. @default 50 */
  staggerDelay?: number;
}

export function animateGroup(elements: HTMLElement[], options: AnimateGroupOptions): Promise<void>;
/** @deprecated #55 — امضای positional؛ از `animateGroup(elements, { direction, name })` استفاده کنید. */
export function animateGroup(
  elements: HTMLElement[],
  direction: TransitionDirection,
  name: string,
  duration?: number,
  staggerDelay?: number,
): Promise<void>;
export function animateGroup(
  elements: HTMLElement[],
  directionOrOptions: TransitionDirection | AnimateGroupOptions,
  legacyName = '',
  legacyDuration = 300,
  legacyStagger = 50,
): Promise<void> {
  const options: Required<AnimateGroupOptions> =
    typeof directionOrOptions === 'string'
      ? {
          direction: directionOrOptions,
          name: legacyName,
          duration: legacyDuration,
          staggerDelay: legacyStagger,
        }
      : {
          direction: directionOrOptions.direction,
          name: directionOrOptions.name,
          duration: directionOrOptions.duration ?? 300,
          staggerDelay: directionOrOptions.staggerDelay ?? 50,
        };
  const { direction, name, duration, staggerDelay } = options;
  if (typeof directionOrOptions === 'string') deprecate(
    'ZEN-DEPR-004',
    'animateGroup(elements, direction, name, duration, staggerDelay)',
    'animateGroup(elements, { direction, name, duration, staggerDelay }) یا createTransition',
  );
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
