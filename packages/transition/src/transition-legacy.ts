// packages/transition/src/transition-legacy.ts
//
// API قدیمی enter/leave — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { ENTER_FROM, ENTER_TO, ENTER_ACTIVE, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE } from './transition-classes';
import { createTransition } from './transition-core';
import type { TransitionDirection, LegacyDirectionOptions } from './transition-types';


export function enterTransition(el: HTMLElement, options: LegacyDirectionOptions): () => void;
/** @deprecated #55 — امضای positional؛ از `enterTransition(el, { name, duration })` استفاده کنید. */
export function enterTransition(
  el: HTMLElement,
  name: string,
  duration?: number,
  onComplete?: () => void,
): () => void;
export function enterTransition(
  el: HTMLElement,
  nameOrOptions: string | LegacyDirectionOptions,
  duration = 300,
  onComplete?: () => void,
): () => void {
  if (typeof nameOrOptions === 'string') {
    // هشدار ZEN-DEPR-002 خودِ runLegacyDirection می‌دهد (warnOnce — یک پیام).
    return runLegacyDirection(el, nameOrOptions, 'enter', duration, onComplete);
  }
  return runLegacyDirection(
    el,
    nameOrOptions.name,
    'enter',
    nameOrOptions.duration ?? 300,
    nameOrOptions.onComplete,
  );
}

/**
 * @deprecated از createTransition استفاده کنید (ZEN-DEPR-003، #47).
 *
 * خروج یک عنصر با transition (leave) — wrapper روی موتور مبنا.
 */
export function leaveTransition(el: HTMLElement, options: LegacyDirectionOptions): () => void;
/** @deprecated #55 — امضای positional؛ از `leaveTransition(el, { name, duration })` استفاده کنید. */
export function leaveTransition(
  el: HTMLElement,
  name: string,
  duration?: number,
  onComplete?: () => void,
): () => void;
export function leaveTransition(
  el: HTMLElement,
  nameOrOptions: string | LegacyDirectionOptions,
  duration = 300,
  onComplete?: () => void,
): () => void {
  if (typeof nameOrOptions === 'string') {
    // هشدار ZEN-DEPR-003 خودِ runLegacyDirection می‌دهد (warnOnce — یک پیام).
    return runLegacyDirection(el, nameOrOptions, 'leave', duration, onComplete);
  }
  return runLegacyDirection(
    el,
    nameOrOptions.name,
    'leave',
    nameOrOptions.duration ?? 300,
    nameOrOptions.onComplete,
  );
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
    direction === 'enter'
      ? 'enterTransition(el, name, duration, onComplete)'
      : 'leaveTransition(el, name, duration, onComplete)',
    'createTransition(name, { duration }).enter(el) یا enterTransition(el, { name, duration })',
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
