// packages/state/src/observer.ts
//
// #147 — تنها نقطهٔ اتصال (hook) برای @zenith/devtools-core (SPEC §۲.۷).
// شکستن چرخهٔ state ↔ devtools: state هیچ وابستگی به devtools یا devtools-core
// ندارد و فقط یک observer اختیاری می‌پذیرد که در prod قابل حذف (tree-shake) و
// در صورت عدم نصب صفر overhead است.

import type { Signal } from './signal';

export interface SignalObserver {
  onCreate?(sig: Signal<any>, name?: string): void;
  onChange?(sig: Signal<any>, oldValue: unknown, newValue: unknown): void;
  onDispose?(sig: Signal<any>): void;
  onName?(sig: Signal<any>, name: string): void;
}

let activeObserver: SignalObserver | null = null;
let legacyCreateHook: ((sig: Signal<any>, name?: string) => void) | null = null;
let legacyChangeHook: ((sig: Signal<any>, oldValue: unknown, newValue: unknown) => void) | null =
  null;

export function _setLegacyRegistryHooks(
  onCreate: (sig: Signal<any>, name?: string) => void,
  onChange: (sig: Signal<any>, oldValue: unknown, newValue: unknown) => void,
): boolean {
  legacyCreateHook = onCreate;
  legacyChangeHook = onChange;
  return true;
}

/**
 * ثبت یا پاک‌کردن observer سیگنال‌ها (SPEC §۲.۷).
 * خروجی یک Cleanup idempotent است که در صورت فعال بودن همین observer، آن را
 * به مقدار قبلی برمی‌گرداند (#116).
 */
export function setSignalObserver(observer: SignalObserver | null): () => void {
  const previous = activeObserver;
  activeObserver = observer;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (activeObserver === observer) {
      activeObserver = previous;
    }
  };
}

export function getSignalObserver(): SignalObserver | null {
  return activeObserver;
}

export function notifySignalCreate(sig: Signal<any>, name?: string): void {
  activeObserver?.onCreate?.(sig, name);
  legacyCreateHook?.(sig, name);
}

export function notifySignalChange(sig: Signal<any>, oldValue: unknown, newValue: unknown): void {
  activeObserver?.onChange?.(sig, oldValue, newValue);
  legacyChangeHook?.(sig, oldValue, newValue);
}

export function notifySignalDispose(sig: Signal<any>): void {
  activeObserver?.onDispose?.(sig);
}

export function notifySignalName(sig: Signal<any>, name: string): void {
  activeObserver?.onName?.(sig, name);
}
