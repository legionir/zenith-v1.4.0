# گزارش حسابرسی پکیج `store`
**نسخه:** v1.3.0 | **بسته:** `@zenith/store`

---

## ۱. خلاصه پکیج

پکیج `store` سیستم مدیریت state متمرکز (شبیه Pinia/Pinia) را در فریم‌ورک Zenith پیاده‌سازی می‌کند. تابع `defineStore` یک store با پشتیبانی از deep proxy reactivity، `versionSignal` برای tracking تغییرات، `deepMerge` برای `$patch`، و getter auto-unwrapping ایجاد می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/store.ts` | ~۴۵۰+ | `defineStore` – تابع اصلی ایجاد store |
| `src/index.ts` | ~۲۰ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-STO-01: `deepProxy` باعث infinite loop با اشیای خود-ارجاع (circular references) می‌شود
- **شدت:** بالا
- **محل:** `src/store.ts` – تابع `deepProxy`
- **شرح:** اگر یک شیء state دارای circular reference باشد (مثلاً `obj.self = obj`)، `deepProxy` وارد حلقه‌ی بی‌نهایت می‌شود و stack overflow رخ می‌دهد.
- **نحوه رفع:** افزودن `WeakSet` برای tracking اشیای دیده‌شده:

```typescript
function deepProxy<T extends object>(
  target: T,
  versionSignal: Signal<number>,
  _visited = new WeakSet<object>(),
): T {
  if (_visited.has(target)) return target; // جلوگیری از circular
  _visited.add(target);

  for (const key of Object.keys(target)) {
    const value = (target as any)[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      (target as any)[key] = deepProxy(value, versionSignal, _visited);
    }
  }
  // ... ایجاد proxy
}
```

### BUG-STO-02: `$patch` با `deepMerge` باعث بازنشانی کلیدهای undefined می‌شود
- **شدت:** متوسط
- **محل:** `src/store.ts` – BUG-05 fix
- **شرح:** BUG-05 که برای رفع مشکل قبلی `deepMerge` اضافه شده ممکن است کاملاً کار نکند اگر one patch دارای nested key باشد که در state اصلی undefined است.
- **نحوه رفع:** استفاده از merge با depth limit:

```typescript
function deepMerge(target: any, source: any, depth = 0, maxDepth = 10): void {
  if (depth > maxDepth) {
    Object.assign(target, source);
    return;
  }
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key], depth + 1, maxDepth);
    } else {
      target[key] = source[key];
    }
  }
}
```

### BUG-STO-03: عدم مدیریت `Symbol` keyها در deep proxy
- **شدت:** کم
- **محل:** `src/store.ts`
- **شرح:** تابع `deepProxy` فقط `Object.keys` را بررسی می‌کند که `Symbol` keyها را نادیده می‌گیرد. اگر state دارای Symbol key باشد، reactivity برای آن key کار نمی‌کند.
- **نحوه رفع:** استفاده از `Reflect.ownKeys`:

```typescript
for (const key of Reflect.ownKeys(target)) {
  if (typeof key === 'symbol') continue; // یا پشتیبانی از Symbol
  const value = (target as any)[key];
  // ...
}
```

### BUG-STO-04: `$reset` با P1-2 fix همچنان مشکل partial reset دارد
- **شدت:** متوسط
- **محل:** `src/store.ts` – P1-2 fix
- **شرح:** P1-2 با بازآفرینی proxy، `$reset` را رفع کرده اما اگر getterها به state خارجی وابسته باشند (cross-store dependency)، reset ممکن است ارجاعات آن‌ها را بشکند.
- **نحوه رفع:** اطمینان از اینکه reset فقط state خود store را بازنشانی می‌کند و getterها پس از reset مجدداً evaluated می‌شوند:

```typescript
$reset(): void {
  // حفظ ارجاع به getterهای خارجی
  const getterKeys = Object.keys(this).filter(k => k.startsWith('get'));
  const getterValues = getterKeys.map(k => ({ key: k, value: (this as any)[k] }));

  // بازنشانی proxy
  this._state = deepProxy({ ...initialState }, versionSignal);
  this._versionSignal.update(v => v + 1);

  // بازگرداندن getterها
  for (const { key, value } of getterValues) {
    (this as any)[key] = value;
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-STO-01: افزودن middleware (plugin) system برای store
- **دلیل:** توسعه‌پذیری و امکان logging, persistence, undo/redo.
- **پیاده‌سازی:**

```typescript
type StorePlugin = (store: StoreInstance) => void;

export function createStorePlugin(plugin: StorePlugin): void {
  _plugins.push(plugin);
}

// در defineStore:
for (const plugin of _plugins) {
  plugin(store);
}
```

### IMP-STO-02: افزودن `$subscribe` برای واکنش به تغییرات
- **دلیل:** بسیاری از توسعه‌دهندگان نیاز به واکنش به تغییرات خاص store دارند.
- **پیاده‌سازی:**

```typescript
type SubscriptionCallback = (mutation: MutationEvent) => void;

$subscribe(callback: SubscriptionCallback): () => void {
  const cleanup = this._versionSignal.subscribe(() => {
    callback({ type: 'patch', storeName: this.$id });
  });
  return cleanup;
}
```

### IMP-STO-03: افزودن persist middleware برای localStorage
- **دلیل:** ذخیره و بازیابی خودکار state در localStorage.
- **پیاده‌سازی:**

```typescript
export function persistStore(store: StoreInstance, key?: string): void {
  const storageKey = key ?? `zenith:store:${store.$id}`;

  // بارگذاری state ذخیره‌شده
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) store.$patch(JSON.parse(saved));
  } catch { /* ignore */ }

  // ذخیره در localStorage هنگام تغییر
  store.$subscribe(() => {
    localStorage.setItem(storageKey, JSON.stringify(store.$state));
  });
}
```

### IMP-STO-04: Type safety بهتر برای getterها
- **دلیل:** getterها به صورت `() => any` تعریف می‌شوند و type inference ضعیفی دارند.
- **پیاده‌سازی:** استفاده از mapped types:

```typescript
type Getters<T> = {
  [K in keyof T as T[K] extends () => any ? K : never]: T[K] extends (...args: any[]) => infer R
    ? R
    : never;
};

export function defineStore<Id extends string, S extends object, G extends Record<string, () => any>>(
  id: Id,
  options: { state: () => S; getters?: G & ThisType<Store<Id, S, G>> },
): Store<Id, S, G> { /* ... */ }
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `signal` و `effect` در هسته store استفاده شده‌اند. | ✅ درست |
| **runtime/context** | Storeها از طریق context در expressionها قابل دسترسی هستند. | ✅ درست |
| **form** | پکیج فرم از الگوی مشابه store استفاده می‌کند اما مستقل است. | ⚠️ هماهنگ نیستند |

---

## ۶. نتیجه‌گیری کلی

پکیج `store` یکی از قوی‌ترین بخش‌های فریم‌ورک Zenith است. معماری deep proxy مشابه Vue/Pinia اما با رویکرد Signal-based. باگ‌های BUG-05 و P1-2 به درستی رفع شده‌اند. مهم‌ترین کمبودها: circular reference handling و نبود plugin system.

**امتیاز کلی: ۷.۵/۱۰** (قوی اما نیاز به circular safety و plugin system)
