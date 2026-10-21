// packages/storage/src/persist.ts
//
// #145 — `persistStore(store, opts) → Cleanup` (SPEC §۲.۵): پلی بین store
// (L1/L2) و storage (L0). وابستگی نوعی به store ندارد — ساختار حداقلی
// PersistTarget کافی است (گیت layering؛ DEC-021). الگوی $subscribe/$patch
// دقیقاً با `@zenith/store` (subscribe همگام + $patch) سازگار است؛ adapter
// لازم در store اضافه شده تا storeهای defineStore بدون تغییر API persist شوند.
import type { Cleanup } from '@zenith/shared';
import { getDefaultStorage } from './singleton';
import type { PersistOptions, PersistTarget, ZenithStorage } from './types';

export function persistStore<S extends object>(
  store: PersistTarget<S>,
  options: PersistOptions<S>,
): Cleanup {
  const storage: ZenithStorage = options.storage ?? getDefaultStorage();
  const key = options.key;
  const selector = options.selector ?? ((s: S) => s);
  const debounceMs = options.debounce ?? 300;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flush = (state: S): void => {
    timer = null;
    if (disposed) return;
    try {
      storage.set(key, selector(state));
    } catch {
      // quota/IO خطا نباید chaine reactivity را بشکند؛ storage خودش
      // ZEN-1102 را از logger گزارش می‌کند.
    }
  };

  // hydrate: اگر دادهٔ ذخیره‌شده هست، اعمال کن (با patch جزئی).
  const saved = storage.get<Partial<S>>(key);
  if (typeof saved === 'object' && saved !== null) store.$patch(saved);

  const off = store.$subscribe((state) => {
    if (disposed) return;
    if (debounceMs <= 0) {
      flush(state);
      return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => flush(state), debounceMs);
  });

  return () => {
    if (disposed) return;
    disposed = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    off();
  };
}
