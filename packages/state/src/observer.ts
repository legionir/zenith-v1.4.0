// packages/state/src/observer.ts
//
// #147 — تنها نقطهٔ اتصال (hook) برای @zenith/devtools-core (SPEC §۲.۷).
// شکستن چرخهٔ state ↔ devtools: state هیچ وابستگی به devtools یا devtools-core
// ندارد و فقط یک observer اختیاری می‌پذیرد. slot مشترک متعلق به همین realm است؛
// سازنده‌های Signal با این slot جایگزین یا یکسان‌سازی نمی‌شوند.

import type { Signal, ReadonlySignal } from './signal';
import { _getStateRuntime, type ObserverLease } from './runtime-state';
import { isGlobalObservationEnabled } from './context';

/** @public */
export interface SignalObserver {
  onCreate?<T>(sig: Signal<T>, name?: string): void;
  onChange?<T>(sig: Signal<T>, oldValue: T, newValue: T): void;
  onDispose?<T>(sig: Signal<T>): void;
  onName?<T>(sig: ReadonlySignal<T>, name: string): void;
}

const runtime = _getStateRuntime();

export function _setLegacyRegistryHooks(
  onCreate: <T>(sig: Signal<T>, name?: string) => void,
  onChange: <T>(sig: Signal<T>, oldValue: T, newValue: T) => void,
): boolean {
  runtime.legacyHooks = { create: onCreate, change: onChange };
  return true;
}

/**
 * ثبت یا پاک‌کردن observer سیگنال‌ها (SPEC §۲.۷).
 * خروجی یک Cleanup idempotent مربوط به همین نصب است، نه برابری شیء observer.
 * حذف خارج از ترتیب فقط نصب زندهٔ پیشین را برمی‌گرداند؛ null موقتاً بی‌صدا می‌کند.
 * هر نصب باید cleanup خود را آزاد کند (#116).
 * @public
 */
export function setSignalObserver(observer: SignalObserver | null): () => void {
  const lease: ObserverLease = { value: observer, previous: runtime.observer, next: null, disposed: false };
  if (lease.previous) lease.previous.next = lease;
  runtime.observer = lease;
  return () => {
    if (lease.disposed) return;
    lease.disposed = true;
    if (lease.next) lease.next.previous = lease.previous;
    else runtime.observer = lease.previous;
    if (lease.previous) lease.previous.next = lease.next;
    lease.value = null; lease.previous = null; lease.next = null;
  };
}

/** @public */
export function getSignalObserver(): SignalObserver | null {
  return runtime.observer?.value ?? null;
}

export function notifySignalCreate<T>(sig: Signal<T>, name?: string): void {
  const observer = getSignalObserver();
  if (observer && isGlobalObservationEnabled()) observer.onCreate?.(sig, name);
  runtime.legacyHooks?.create(sig, name);
}

export function notifySignalChange<T>(sig: Signal<T>, oldValue: T, newValue: T): void {
  const observer = getSignalObserver();
  if (observer && isGlobalObservationEnabled()) observer.onChange?.(sig, oldValue, newValue);
  runtime.legacyHooks?.change(sig, oldValue, newValue);
}

export function notifySignalDispose<T>(sig: Signal<T>): void {
  const observer = getSignalObserver();
  if (observer && isGlobalObservationEnabled()) observer.onDispose?.(sig);
}

export function notifySignalName<T>(sig: ReadonlySignal<T>, name: string): void {
  const observer = getSignalObserver();
  if (observer && isGlobalObservationEnabled()) observer.onName?.(sig, name);
}
