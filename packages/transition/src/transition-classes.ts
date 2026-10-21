// packages/transition/src/transition-classes.ts
//
// کلاس‌ها و اندازه‌گیری مدت — استخراج مکانیکی از transition.ts،
// بدون تغییر رفتار (#40).

import type { TransitionClasses } from './transition-types';


export const ENTER_FROM = 'zen-enter-from';
export const ENTER_TO = 'zen-enter-to';
export const LEAVE_FROM = 'zen-leave-from';
export const LEAVE_TO = 'zen-leave-to';
export const ENTER_ACTIVE = 'zen-enter-active';
export const LEAVE_ACTIVE = 'zen-leave-active';

export const DEFAULT_CLASSES: Required<TransitionClasses> = {
  enterFrom: ENTER_FROM,
  enterActive: ENTER_ACTIVE,
  enterTo: ENTER_TO,
  leaveFrom: LEAVE_FROM,
  leaveActive: LEAVE_ACTIVE,
  leaveTo: LEAVE_TO,
};

export function classTokens(className: string): string[] {
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

export function measureTransitionDuration(el: HTMLElement): number {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return 0;
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

export function addClasses(el: HTMLElement, className: string): void {
  el.classList.add(...classTokens(className));
}

export function removeClasses(el: HTMLElement, className: string): void {
  el.classList.remove(...classTokens(className));
}
