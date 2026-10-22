// packages/virtual-list/src/virtual-list-items.ts
//
// انیمیشن و بایندینگ آیتم‌ها — استخراج مکانیکی از virtual-list.ts،
// بدون تغییر رفتار (#40).

import type { Signal } from '@zenith/state';
import type { VirtualListController } from './virtual-list-config';


// ── Animate Mount/Unmount ──
// (انیمیشن mount/unmount آیتم‌ها: فقط در همین wrapper مصرف می‌شود؛
// موتور مبنا از آن بی‌خبر است — #47.)
const MOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeIn: [{ opacity: '0' }, { opacity: '1' }],
  slideDown: [
    { transform: 'translateY(-10px)', opacity: '0' },
    { transform: 'none', opacity: '1' },
  ],
  slideUp: [
    { transform: 'translateY(10px)', opacity: '0' },
    { transform: 'none', opacity: '1' },
  ],
  scaleIn: [
    { transform: 'scale(0.9)', opacity: '0' },
    { transform: 'scale(1)', opacity: '1' },
  ],
};

const UNMOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeOut: [{ opacity: '1' }, { opacity: '0' }],
  slideUp: [
    { transform: 'none', opacity: '1' },
    { transform: 'translateY(-10px)', opacity: '0' },
  ],
  slideDown: [
    { transform: 'none', opacity: '1' },
    { transform: 'translateY(10px)', opacity: '0' },
  ],
  scaleOut: [
    { transform: 'scale(1)', opacity: '1' },
    { transform: 'scale(0.9)', opacity: '0' },
  ],
};

export function animateItem(el: HTMLElement, preset: string, isMount: boolean): void {
  const presets = isMount ? MOUNT_PRESETS : UNMOUNT_PRESETS;
  const keyframes = presets[preset];
  if (!keyframes || typeof el.animate !== 'function') return;
  const anim = el.animate(keyframes, { duration: 200, easing: 'ease-out' });
  anim.onfinish = () => {
    try {
      anim.commitStyles();
    } catch {
      /* noop */
    }
    anim.cancel();
  };
}

/** context آیتم‌محور: $item/$index getter + نگاشت سیگنال‌ها برای zen-* . */
export interface ItemBinding {
  itemSignal: Signal<unknown>;
  indexSignal: Signal<number>;
  ctx: Record<string, unknown>;
  itemDisposes: (() => void)[];
}

/**
 * #116: ساخت controller — یک تابع (Cleanup قرارداد: صدا زدن = dispose) با
 * متدهای scrollToIndex/rebuild/getRange/dispose. Idempotent.
 */
export function makeController(
  disposeImpl: () => void,
  ctrl: Pick<VirtualListController, 'scrollToIndex' | 'rebuild' | 'getRange'>,
): VirtualListController {
  let disposed = false;
  const self = (): void => {
    if (disposed) return;
    disposed = true;
    disposeImpl();
  };
  return Object.assign(self, {
    scrollToIndex: ctrl.scrollToIndex,
    rebuild: ctrl.rebuild,
    getRange: ctrl.getRange,
    dispose: self,
  });
}
