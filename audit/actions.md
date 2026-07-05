# گزارش حسابرسی پکیج `actions`
**نسخه:** v1.3.0 | **بسته:** `@zenith/actions`

---

## ۱. خلاصه پکیج

پکیج `actions` لایه‌ی انتزاعی برای ثبت و فراخوانی Action‌های سفارشی در فریم‌ورک Zenith است.
این پکیج عمدتاً یک کلاس `ActionRegistry` و توابع کمکی `registerAction` و `getAction` را ارائه می‌دهد که توسط پکیج‌های `runtime` و `events` برای اتصال رویدادهای DOM به اجرای اکشن‌ها استفاده می‌شود.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/index.ts` | ~۳۰ | Export توابع و کلاس‌ها |
| `src/actions.ts` | ~۱۵۰ | پیاده‌سازی `ActionRegistry` |

فایل `src/actions.ts` کلاس `ActionRegistry` را پیاده‌سازی می‌کند که یک `Map<string, Function>` برای نگهداری اکشن‌های ثبت‌شده دارد.

---

## ۳. باگ‌ها و مشکلات

### BUG-ACT-01: عدم پشتیبانی از `destroy`/`teardown` برای اکشن‌ها
- **شدت:** متوسط
- **محل:** `ActionRegistry`
- **شرح:** کلاس `ActionRegistry` متدی برای پاکسازی یا `destroy` ندارد. در سناریوی HMR یا حذف کامپوننت، اکشن‌های ثبت‌شده در حافظه باقی می‌مانند و امکان garbage collection ندارند.
- **نحوه رفع:** افزودن متد `destroy()` و پشتیبانی از `WeakRef` یا `Symbol.dispose`:

```typescript
export class ActionRegistry {
  private _actions = new Map<string, Function>();
  // ...متدهای موجود

  destroy(): void {
    this._actions.clear();
  }

  get size(): number {
    return this._actions.size;
  }
}
```

### BUG-ACT-02: عدم اعتبارسنجی نام اکشن
- **شدت:** کم
- **محل:** `src/actions.ts` – متد `register`
- **شرح:** نام اکشن بدون هیچ اعتبارسنجی (pattern validation) ذخیره می‌شود. ممکن است کاربر نام‌های حاوی فاصله یا کاراکترهای خاص ثبت کند که در HTML attribute (`zen-action:*`) قابل استفاده نباشند.
- **نحوه رفع:** افزودن اعتبارسنجی در `registerAction`:

```typescript
export function registerAction(name: string, handler: Function): void {
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    throw new Error(
      `[Zenith] Invalid action name "${name}". Action names must be valid JavaScript identifiers.`,
    );
  }
  // ...
}
```

### BUG-ACT-03: نبود override protection برای اکشن‌های built-in
- **شدت:** کم
- **محل:** `src/actions.ts`
- **شرح:** اگر کاربر سعی کند اکشن built-in مانند `click` را override کند، سیستم هشدار نمی‌دهد و اکشن قبلی بی‌صدا جایگزین می‌شود. این می‌تواند باعث رفتار غیرمنتظره شود.
- **نحوه رفع:** اگر اکشن قبلاً ثبت شده باشد، می‌توان یک warning در کنسول چاپ کرد (بدون throw چون override ممکن است deliberate باشد):

```typescript
export function registerAction(name: string, handler: Function, _options?: { force?: boolean }): void {
  if (registry.has(name)) {
    console.warn(`[Zenith] Action "${name}" is being overridden.`);
  }
  registry.set(name, handler);
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-ACT-01: افزودن middleware/pipeline برای اکشن‌ها
- **دلیل:** بسیاری از فریم‌ورک‌های مشابه امکان middleware (مانند logging, authorization, validation) بین trigger و اجرای اکشن فراهم می‌کنند.
- **پیاده‌سازی:**

```typescript
type ActionMiddleware = (name: string, args: any[], next: () => any) => any;

export class ActionRegistry {
  private _middlewares: ActionMiddleware[] = [];

  use(mw: ActionMiddleware): void {
    this._middlewares.push(mw);
  }

  async execute(name: string, ...args: any[]): Promise<any> {
    const handler = this._actions.get(name);
    if (!handler) throw new Error(`Action "${name}" not found`);

    const pipeline = this._middlewares.reduceRight(
      (next, mw) => () => mw(name, args, next),
      () => handler(...args),
    );
    return pipeline();
  }
}
```

### IMP-ACT-02: افزودن تایپ‌های قوی‌تر (Generic)
- **دلیل:** ارتقای TypeScript safety.
- **پیاده‌سازی:**

```typescript
type ActionHandler<TArgs extends any[] = any[], TReturn = any> = (...args: TArgs) => TReturn;

export function registerAction<TArgs extends any[] = any[], TReturn = any>(
  name: string,
  handler: ActionHandler<TArgs, TReturn>,
): void { /* ... */ }

export function getAction<TArgs extends any[] = any[], TReturn = any>(
  name: string,
): ActionHandler<TArgs, TReturn> | undefined { /* ... */ }
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **events** | `delegation.ts` با `splitActionArgs` نام اکشن را استخراج و با `getAction` فراخوانی می‌کند. | ✅ درست |
| **runtime** | `Zen.action()` از `registerAction` استفاده می‌کند. | ✅ درست |
| **crud** | اکشن‌های CRUD را ثبت می‌کند: `crudList, crudCreate, crudUpdate, crudDelete, crudRefresh`. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `actions` یک لایه ساده و مینیمال است که وظیفه‌اش را به درستی انجام می‌دهد. مهم‌ترین نقص آن نبود متد `destroy()` برای پاکسازی در HMR است. با توجه به اینکه فریم‌ورک Zenith یک فریم‌ورک reactive است، این مسئله می‌تواند در بلندمدت باعث نشت حافظه شود.

**امتیاز کلی: ۷/۱۰** (سادگی خوب است اما کمبود امکانات middleware و destroy قابل توجه است)
