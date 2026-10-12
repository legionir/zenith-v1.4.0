// packages/storage/src/signal.ts — زیرمسیر @zenith/storage/signal (SPEC §۲.۵)
//   signal(key, initial, o?) ⇒ StorageSignal متصل به نمونهٔ پیش‌فرض storage.
// import از state (L1) ندارد؛ ساختاری Readable<T> است (DEC-021).
import { getDefaultStorage } from './singleton';
import { createStorageSignal, type StoredSignalOptions } from './signal-core';

export { createStorageSignal, type StoredSignalOptions } from './signal-core';

export function signal<T>(key: string, initial: T, options?: StoredSignalOptions) {
  return createStorageSignal(getDefaultStorage(), key, initial, options);
}
