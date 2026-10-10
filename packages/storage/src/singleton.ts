// packages/storage/src/singleton.ts
//
// #145 — نمونهٔ پیش‌فرض storage (namespace `zen`). auth/store/demo همه از
// همین یک نمونه استفاده می‌کنند تا کلیدها و sync بین‌تب مشترک بماند.
// ساخت lazy: در import هیچ window/localStorage خوانده نمی‌شود (env-import).
import { createStorage } from './storage';
import type { ZenithStorage } from './types';

let instance: ZenithStorage | null = null;

/** نمونهٔ مشترک (lazy). برای تست `resetDefaultStorage()` را صدا بزنید. */
export function getDefaultStorage(): ZenithStorage {
  if (!instance) instance = createStorage();
  return instance;
}

/** آزادسازی نمونهٔ پیش‌فرض (تست/teardown). idempotent. */
export function resetDefaultStorage(): void {
  instance?.dispose();
  instance = null;
}
