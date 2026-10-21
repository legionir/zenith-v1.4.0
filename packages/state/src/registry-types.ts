import type { Signal } from './signal';
/** Safe heterogeneous registry view; the actual object is not wrapped. @public */
export type InspectedSignal = Pick<Signal<unknown>, 'get' | 'peek' | 'subscriberCount' | 'removeSubscriber' | 'dispose'>;

/**
 * اطلاعات یک Signal در رجیستری.
 * @public
 *
 * @deprecated از `SignalInfo` در `@zenith/devtools-core` استفاده کنید (#147 / #50، ZEN-DEPR-029).
 */

export interface SignalInfo {
  /** ID یکتای Signal. */
  id: number;
  /** نام Signal (اگر کاربر تعیین کرده باشد). */
  name?: string;
  /** مقدار فعلی. */
  value: unknown;
  /** تعداد subscribers (Effectهای وابسته). */
  subscriberCount: number;
  /** زمان ساخت (timestamp). */
  createdAt: number;
  /**
   * Reference ضعیف (Weak) به خود Signal.
   *
   * Bug Fix #5: قبلاً این فیلد مستقیماً Signal را نگه می‌داشت که باعث
   * memory leak می‌شد. اکنون WeakRef است تا GC بتواند Signal را پاک کند.
   *
   * برای دسترسی به Signal واقعی از `info.signalRef.deref()` استفاده کنید.
   * اگر Signal ای GC شده باشد، `deref()` برمی‌گرداند `undefined`.
   */
  signalRef: WeakRef<InspectedSignal>;
}

/**
 * اطلاعات یک تغییر State (برای Timeline).
 * @public
 *
 * @deprecated از `StateChange` در `@zenith/devtools-core` استفاده کنید (#147 / #50، ZEN-DEPR-031).
 */
export interface StateChange {
  /** ID Signal که تغییر کرده. */
  signalId: number;
  /** نام Signal (اگر موجود). */
  signalName?: string;
  /** مقدار قبلی. */
  oldValue: unknown;
  /** مقدار جدید. */
  newValue: unknown;
  /** زمان تغییر (timestamp). */
  timestamp: number;
  /** Stack trace (برای دیباگ). */
  stack?: string;
}

