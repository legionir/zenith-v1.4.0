// packages/storage/src/index.ts
//
// #145 — @zenith/storage: لایهٔ واحد ذخیره‌سازی (SPEC §۲.۵) — L0.
//
// قوانین لایه (گیت: test/layering.test.ts):
//   • وابستگی فقط errors + shared + logger (L0). هیچ import از state/scheduler
//     (L1) در barrel — سیگنال با reactive ساختاری خودکفا (signal-core).
//   • import در سطح ماژول به window/document/localStorage دسترسی ندارد
//     (env-import)؛ درایورها هنگام فراخوانی محیط را می‌سنجند.
//   • بودجه ≤ ۴KB gzip (size-budget + .size-limit.json).
export type {
  CookieOptions,
  DataValidator,
  DriverName,
  IDBOptions,
  PersistConfig,
  PersistOptions,
  PersistTarget,
  QuotaPolicy,
  Serializer,
  SetOptions,
  StorageDriver,
  StorageEventPayload,
  StorageOptions,
  StorageRecord,
  StorageSignal,
  SyncBus,
  ZenithStorage,
} from './types';

export { createStorage, DEFAULTS, isStorageAvailable } from './storage';
export {
  buildCookieString,
  cookieDriver,
  driverByName,
  indexedDBDriver,
  localDriver,
  memoryDriver,
  sessionDriver,
} from './drivers';
export type { IndexedDBDriver } from './drivers';
export { parsePersistAttr } from './attr';
export { persistStore } from './persist';
export { getDefaultStorage, resetDefaultStorage } from './singleton';
