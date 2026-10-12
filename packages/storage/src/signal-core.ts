// packages/storage/src/signal-core.ts
//
// #145 — سیگنال ذخیره‌سازی (SPEC §۲.۵ `storage.signal`).
//
// چرا @zenith/state را import نمی‌کند: لایهٔ L0 حق یال به L1 را ندارد
// (گیت layering). این سیگنال ساختاری `Readable<T>` (DEC-021: هر ظرف با
// `get(): T`) را خودکفا برآورده می‌کند؛ با تب‌های دیگر از طریق events
// خودِ storage همگام می‌ماند. این ماژول برگ برندهٔ چرخه است: هیچ import از
// singleton/storage ندارد و فقط نوع ZenithStorage را می‌شناسد.
import type { Cleanup } from '@zenith/shared';
import type { SetOptions, StorageSignal, ZenithStorage } from './types';

/** گزینه‌های signal (SPEC §۲.۵: `signal(key, initial, o?)`) = SetOptions. */
export type StoredSignalOptions = SetOptions;

export function createStorageSignal<T>(
  storage: Pick<ZenithStorage, 'get' | 'set' | 'subscribe'>,
  key: string,
  initial: T,
  options: StoredSignalOptions = {},
): StorageSignal<T> {
  const stored = storage.get<T>(key);
  let value = stored === undefined ? initial : stored;
  const subs = new Set<(v: T) => void>();
  let disposed = false;

  // تغییر از بیرون (تب دیگر / set روی همان کلید) ⇒ به‌روزرسانی سیگنال.
  const offStorage: Cleanup = storage.subscribe<T>(key, (payload) => {
    const next = payload.value === undefined ? initial : payload.value;
    if (Object.is(next, value)) return;
    value = next;
    for (const cb of [...subs]) cb(value);
  });

  const signalObj: StorageSignal<T> = {
    get() {
      return value;
    },
    set(next: T) {
      if (disposed) return;
      if (Object.is(next, value)) return;
      value = next;
      // subscribe بالا مقدار را ست می‌کند؛ Object.is guard از double-emit
      // جلوگیری می‌کند.
      storage.set(key, next, options);
      for (const cb of [...subs]) cb(value);
    },
    subscribe(cb: (v: T) => void): Cleanup {
      if (disposed) return () => {};
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offStorage();
      subs.clear();
    },
  };
  return signalObj;
}
