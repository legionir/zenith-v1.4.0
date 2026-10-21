// packages/devtools-core/src/core-types.ts
//
// تایپ‌های عمومی هستهٔ DevTools — استخراج مکانیکی از index.ts بدون تغییر
// رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import type { Cleanup } from '@zenith/shared';


/** Read-only heterogeneous inspection view; it is not a writable Signal<unknown>. @public */
export interface UntypedSignal<T = unknown> {
  get(): T;
  peek?(): T;
  subscriberCount?: number;
}

/** @public */
export interface SignalInfo {
  /** شناسهٔ رشته‌ای یکتا (مثلاً `'sig-1'`). */
  id: string;
  /** نام اختیاری سیگنال. */
  name?: string;
  /** مقدار فعلی (یا خلاصه در حالت `captureValues: false`). */
  value: unknown;
  /** تعداد subscriberهای فعال. */
  subscriberCount: number;
  /** آیا computed است؟ */
  computed: boolean;
  /** زمان ساخت (ms). */
  createdAt: number;
  /** مرجع ضعیف به نمونهٔ Signal برای جلوگیری از نشت حافظه. */
  signalRef: WeakRef<UntypedSignal>;
}

/** @public */
export interface StateChange {
  /** شناسهٔ یکتای رخداد تغییر. */
  id: string;
  /** شناسهٔ رشته‌ای سیگنال. */
  signalId: string;
  /** نام سیگنال (در صورت وجود). */
  signalName?: string;
  /** مقدار قبلی. */
  oldValue: unknown;
  /** مقدار جدید. */
  newValue: unknown;
  /** زمان تغییر (ms). */
  timestamp: number;
}

/** @public */
export interface SnapshotSignalEntry {
  name?: string;
  value: unknown;
}

/** @public */
export interface Snapshot {
  version: string;
  timestamp: number;
  signals: Record<string, SnapshotSignalEntry>;
  timelineLength: number;
}

/** @public */
export interface DevtoolsHookEventMap {
  'signal:create': SignalInfo;
  'signal:change': StateChange;
  'signal:dispose': { id: string };
  'signal:name': { id: string; name: string };
  'snapshot:restore': Snapshot;
  [event: string]: unknown;
}

/** @public */
export interface ZenithDevtoolsCoreHook {
  readonly version: string;
  emit<K extends keyof DevtoolsHookEventMap>(event: K, payload: DevtoolsHookEventMap[K]): void;
  on<K extends keyof DevtoolsHookEventMap>(
    event: K,
    handler: (payload: DevtoolsHookEventMap[K]) => void,
  ): Cleanup;
}