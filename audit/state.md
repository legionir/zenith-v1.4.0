# گزارش ممیزی جامع پکیج `@zenith/state` v1.3.0

**تاریخ**: 1405-04-09 (2026-06-30)  
**نسخه**: v1.3.0  
**نام پکیج**: `@zenith/state`  
**مسیر**: `packages/state/src/`

---

## ساختار فایل‌ها

پکیج state شامل شش فایل منبع است که در ادامه به تفکیک هر یک بررسی می‌شود:

### 1. `packages/state/src/signal.ts` (هسته سیستم)
- **کلاس `Signal<T>`**: ظرف واکنش‌گرا با متدهای `get()`، `set()`، `update()`، `peek()`
- **مکانیزم Dependency Tracking**: در `get()` از `activeEffect` برای ثبت subscriber و `registerCleanup` برای پاکسازی استفاده می‌کند
- **مکانیزم Notification**: در `set()` از Scheduler برای اجرای Effectها با اولویت استفاده می‌کند
- **متغیرهای سراسری Context**: `activeEffect`، `activeCleanupRegistration`، `effectContextProvider`
- **توابع کمکی**: `setActiveEffect()`، `getActiveEffect()`، `setActiveCleanupRegistration()`، `registerCleanup()`، `signal()`، `untrack()`

### 2. `packages/state/src/effect.ts` (اجرای عوارض جانبی)
- **توابع**: `effect()`، `setCurrentPriority()`، `getCurrentPriority()`، `getEffectPriority()`، `triggerEffects()` (deprecated)
- **ساختار داخلی**: هر Effect دارای `cleanupQueue`، اولویت (`Priority`)، و مکانیزم re-tracking
- **مدیریت Priority**: از طریق `effectPriorityMap` (WeakMap تابع → Priority)
- **خطا**: در صورت throw در `fn()`، cleanupهای ثبت‌شده اجرا می‌شوند و خطا مجدداً پرتاب می‌شود

### 3. `packages/state/src/computed.ts` (مقادیر مشتق‌شده)
- **کلاس `Computed<T>`**: یک Signal فقط‌خواندنی که مقدارش از روی Signalهای دیگر محاسبه می‌شود
- **مکانیزم داخلی**: `innerSignal` + `effect()` داخلی برای ردیابی وابستگی‌ها
- **Lazy Evaluation**: با `Object.is` از به‌روزرسانی‌های غیرضروری جلوگیری می‌کند
- **Dispose**: امکان آزادسازی منابع

### 4. `packages/state/src/batch.ts` (سازگاری با نسخه‌های قبل - Compatibility Layer)
- **تابع `batch()`**: در فاز ۷ یک no-op محض است
- **تابع `isBatching()`**: همیشه `false` برمی‌گرداند
- **تابع `addEffectToBatch()`**: no-op

### 5. `packages/state/src/registry.ts` (ردیابی برای DevTools - فاز ۱۰)
- **رجیستری سراسری**: `idToInfo` (Map)، `signalToId` (WeakMap)
- **WeakRef + FinalizationRegistry**: برای جلوگیری از Memory Leak
- **State Timeline**: حداکثر ۱۰۰۰ تغییر آخر
- **State Change Listeners**: برای DevTools

### 6. `packages/state/src/index.ts` (نقطه ورود عمومی)
- Export همه APIهای عمومی: `signal`، `Signal`، `untrack`، `setEffectContextStore`، `EffectContext`، `effect`، `getEffectPriority`، `computed`، `Computed`، `batch`، `Priority`، توابع registry

---

## باگ‌ها و مشکلات (Bugs & Issues)

### BUG-01: ثبت `oldValue` اشتباه در متد `update()` Signal

| مشخصه | مقدار |
|---|---|
| **شدت** | **بالا** |
| **فایل** | `packages/state/src/signal.ts` |
| **خط** | ~۱۵۴ |

**شرح**:  
در متد `update()`، متغیر `this._value` پیش از فراخوانی `recordStateChange()` مقداردهی مجدد می‌شود. در نتیجه `oldValue` و `newValue` که به DevTools Timeline ارسال می‌شوند، هر دو یکسان هستند. این به‌معنای از دست رفتن کامل مقدار قبلی در تاریخچه تغییرات است.

```typescript
// کد فعلی (مشکل‌دار):
update(fn: (current: T) => T): void {
    const next = fn(this._value);
    this._value = next;          // ← this._value اکنون برابر next است
    // ── فاز ۱۰: ثبت تغییر در Registry ──
    recordStateChange(this, this._value, next);  // ← bug: oldValue === newValue
    // ...
}
```

**نحوه رفع**:  
مقدار قبلی را پیش از هر تغییری ذخیره کنید:

```typescript
update(fn: (current: T) => T): void {
    const oldValue = this._value;
    const next = fn(oldValue);
    this._value = next;
    recordStateChange(this, oldValue, next);
    // ── فاز ۷: Scheduler ──
    this._subscribers.forEach(effectFn => {
        const priority = getEffectPriority(effectFn);
        scheduleEffect(effectFn, priority);
    });
}
```

---

### BUG-02: `SchedulerAdapter` بی‌اثر - `configureScheduler()` هرگز خوانده نمی‌شود

| مشخصه | مقدار |
|---|---|
| **شدت** | **متوسط** |
| **فایل** | `packages\scheduler\src\scheduler.ts` |
| **خط** | ~۳۴۴-۳۵۴ (تعریف) و ~۲۳۵ (محل مصرف) |

**شرح**:  
در فاز ۱.۳.۰ قابلیت `SchedulerAdapter` و `configureScheduler()` اضافه شده تا توسعه‌دهنده بتواند Scheduler پیش‌فرض مبتنی بر Microtask را با یک scheduler سفارشی (مثلاً `requestAnimationFrame` یا React-style time-slicing) جایگزین کند. اما متأسفانه `scheduleEffect()` (که قلب Scheduler است) هرگز `_customAdapter.current` را چک نمی‌کند و مستقیماً از صف `queue` استفاده می‌کند. در نتیجه `configureScheduler()` هیچ اثری بر عملکرد واقعی ندارد.

```typescript
// scheduler.ts خط ۳۴۴-۳۵۴ — تعریف شده ...
export const _customAdapter: { current: SchedulerAdapter | null } = { current: null };
export function configureScheduler(adapter: SchedulerAdapter | null): void {
    _customAdapter.current = adapter;
}

// ... اما هرگز در scheduleEffect استفاده نمی‌شود (خط ۲۳۵-۲۵۴)
export function scheduleEffect(effectFn: Function, priority: Priority = 'normal'): void {
    // ❌ هیچ چک _customAdapterای وجود ندارد
    const existing = queue.get(effectFn);
    // ... مستقیماً از queue استفاده می‌کند
    queue.set(effectFn, { fn: effectFn, priority, seq: nextSeq++ });
    if (!isFlushing && !flushPromise) {
        flushPromise = Promise.resolve().then(flushQueue);
    }
}
```

**نحوه رفع**:  
در ابتدای `scheduleEffect()`، `_customAdapter` را چک کنید:

```typescript
export function scheduleEffect(effectFn: Function, priority: Priority = 'normal'): void {
    // If a custom adapter is configured, delegate to it
    if (_customAdapter.current) {
        _customAdapter.current.schedule(effectFn, priority);
        return;
    }
    // ... ادامه منطق فعلی
}
```

همچنین در `flushSync()`:
```typescript
export function flushSync(): void {
    if (isFlushing) return;
    if (_customAdapter.current) {
        _customAdapter.current.flush();
        return;
    }
    flushQueue();
}
```

---

### BUG-03: اجرای دوباره `computation()` در سازنده `Computed` (برای توابع ناخالص مخرب است)

| مشخصه | مقدار |
|---|---|
| **شدت** | **متوسط** |
| **فایل** | `packages/state/src/computed.ts` |
| **خط** | ~۴۳ (بار اول) و ~۵۲ (بار دوم) |

**شرح**:  
در سازنده `Computed`، تابع `computation()` دو بار اجرا می‌شود:

1. خط ۴۳: `this._value = this.computation();` — برای مقداردهی اولیه (بدون ردیابی وابستگی)
2. خط ۵۲: داخل `effect()`: `const newValue = this.computation();` — برای ثبت وابستگی‌ها

برای توابع خالص (Pure) این فقط یک افت عملکرد است (۲ برابر زمان محاسبه). اما برای توابع ناخالص (Impure) که شامل `Date.now()`، `Math.random()`، یا عملیات جانبی هستند، این دو اجرا می‌توانند نتایج متفاوتی تولید کنند:

```typescript
const rnd = computed(() => Math.random());
rnd.get(); // مثلاً ۰.۷۷۴
// اولین اجرا در constructor: ۰.۱۲۳ (در this._value ذخیره شد)
// دومین اجرا در effect: ۰.۴۵۶ (در innerSignal ذخیره شد)
// مقدار نهایی: ۰.۴۵۶ — اولین اجرا کاملاً بی‌فایده بود
```

**نحوه رفع**:  
از اجرای مجدد در effect خودداری کنید. مقدار اولیه را مستقیماً به `innerSignal` بدهید و `this._value` را در اولین اجرای effect مقداردهی کنید:

```typescript
constructor(private computation: () => T) {
    // مقدار اولیه را مستقیماً محاسبه کن — بدون اجرای مجدد computation
    this._value = undefined as unknown as T; // placeholder
    this._innerSignal = signal<T>(undefined as unknown as T);

    this._cleanup = effect(() => {
        const newValue = this.computation();
        if (!Object.is(newValue, this._value)) {
            this._value = newValue;
            this._innerSignal.set(newValue);
        }
    });
}

get(): T {
    return this._innerSignal.get();
}
```

> **نکته**: این تغییر نیازمند اطمینان از این است که `_innerSignal` قبل از اولین اجرای effect همیشه `undefined` برمی‌گرداند. از آنجا که `effect()` به‌صورت synchronous اجرا می‌شود، تا پایان سازنده `_innerSignal` مقدار صحیح را خواهد داشت.

**راه‌حل جایگزین**: مقدار اولیه محاسبه‌شده را به `_innerSignal` بدهید و از اجرای مجدد در effect جلوگیری کنید:

```typescript
constructor(private computation: () => T) {
    this._value = this.computation();
    this._innerSignal = signal<T>(this._value);

    this._cleanup = effect(() => {
        const newValue = this.computation();
        if (!Object.is(newValue, this._value)) {
            this._value = newValue;
            this._innerSignal.set(newValue);
        }
    });
}
```

در راه دوم، `computation` همچنان دو بار اجرا می‌شود اما برای توابع خالص مشکلی نیست. بهترین راه استفاده از Lazy Initialization است.

---

### BUG-04: نشت حافظه در `registry.ts` در غیاب `FinalizationRegistry`

| مشخصه | مقدار |
|---|---|
| **شدت** | **متوسط** |
| **فایل** | `packages/state/src/registry.ts` |
| **خط** | ~۱۳۰-۱۳۵، ~۲۸۴-۲۹۲ |

**شرح**:  
`FinalizationRegistry` (خط ۱۳۰-۱۳۵) در تمام محیط‌ها در دسترس نیست (مثلاً Node.js < ۱۴.۶). وقتی این API در دسترس نباشد، پاکسازی خودکار Signalهای GC شده از `idToInfo` انجام نمی‌شود. تنها راه پاکسازی دستی از طریق `cleanupDisposedSignals()` است — اما این تابع فقط در `getAllSignals()` فراخوانی می‌شود که آن هم فقط توسط DevTools استفاده می‌شود. در حالت Production بدون DevTools فعال، `idToInfo` به‌طور نامحدود رشد می‌کند.

```typescript
const finalizationRegistry: FinalizationRegistry<number> | null =
    typeof FinalizationRegistry !== 'undefined'
        ? new FinalizationRegistry<number>((id: number) => {
              idToInfo.delete(id);
          })
        : null;  // ← fallback: null — بدون پاکسازی خودکار
```

**نحوه رفع**:  
یک تایمر دوره‌ای برای پاکسازی اضافه کنید یا در `recordStateChange()` و `registerSignal()` نیز `cleanupDisposedSignals()` را به‌صورت محدود فراخوانی کنید:

```typescript
let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 60_000; // هر ۶۰ ثانیه یکبار

function maybeCleanupDisposedSignals(): void {
    if (finalizationRegistry !== null) return; // FinalizationRegistry کافی است
    const now = Date.now();
    if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        lastCleanupTime = now;
        cleanupDisposedSignals();
    }
}
```

سپس `maybeCleanupDisposedSignals()` را در ابتدای `registerSignal()` و `recordStateChange()` فراخوانی کنید.

---

### BUG-05: Circular Dependency بین `signal.ts` و `effect.ts`

| مشخصه | مقدار |
|---|---|
| **شدت** | **کم** |
| **فایل** | `packages/state/src/signal.ts` ← `./effect` و `packages/state/src/effect.ts` ← `./signal` |

**شرح**:  
واردات دایره‌ای (Circular Import) بین دو ماژول اصلی:
- `signal.ts` از `./effect` وارد می‌کند: `getEffectPriority`
- `effect.ts` از `./signal` وارد می‌کند: `setActiveEffect`, `setActiveCleanupRegistration`

هر چند TypeScript با این الگو در بسیاری از موارد کنار می‌آید، اما دلایل زیر آن را شکننده می‌کند:
1. وابسته به hoisting و live binding در ES modules است که با برخی bundlerها (Webpack 4 قدیمی، برخی Rollup پلاگین‌ها) ممکن است کار نکند
2. ترتیب import در ماژول‌ها اهمیت پیدا می‌کند — تغییر ترتیب exportها می‌تواند باعث `undefined` شدن functionها شود
3. تست‌های unit isolation را دشوارتر می‌کند

**نحوه رفع**:  
context مشترک (activeEffect, activeCleanupRegistration, EffectContext) را به یک فایل سوم مانند `context.ts` منتقل کنید:

```typescript
// packages/state/src/context.ts (جدید)
export interface EffectContext {
    activeEffect: Function | null;
    activeCleanupRegistration: ((cleanup: () => void) => void) | null;
}

let effectContextProvider: (() => EffectContext | null) | null = null;
// ... Context functions
```

سپس هم `signal.ts` و هم `effect.ts` فقط از `./context` import کنند.

---

### BUG-06: تست‌ها وجود ندارند (Missing Tests)

| مشخصه | مقدار |
|---|---|
| **شدت** | **بالا** |
| **فایل** | `packages/state/package.json` |
| **خط** | ~۲۲-۲۴ (اشاره به فایل‌های تست) |

**شرح**:  
در `package.json` سه فایل تست تعریف شده است:
```json
"test": "tsx test/test.ts && tsx test/test-priority-wiring.ts && tsx test/test-weakref-registry.ts"
```

اما **دایرکتوری `test/` و هیچ فایل تستی وجود ندارد**. دستور `npm test` با خطا مواجه می‌شود. این یک شکاف جدی در پوشش تستی است، به‌ویژه برای یک سیستم واکنش‌گرا که در قلب فریم‌ورک قرار دارد: signal، effect، computed، batch، scheduler integration، priority queue، WeakRef registry —هیچ‌کدام تست unit ندارند.

**نحوه رفع**:  
فایل‌های تست را ایجاد کنید که حداقل سناریوهای زیر را پوشش دهند:
- Signal core: get/set, Object.is equality, update, peek, untrack
- Effect: execution, re-execution on signal change, dispose, priority, error handling
- Computed: caching, lazy evaluation, chained computed, dispose
- Batch/Registry: integration tests
- Cross-package: scheduler integration

---

### BUG-07: عدم بررسی `Object.is()` در متد `update()`

| مشخصه | مقدار |
|---|---|
| **شدت** | **کم** |
| **فایل** | `packages/state/src/signal.ts` |
| **خط** | ~۱۴۸-۱۶۰ |

**شرح**:  
متد `set()` دارای گارد `Object.is` است که در صورت عدم تغییر واقعی مقدار، از notification جلوگیری می‌کند:
```typescript
set(newValue: T): void {
    if (Object.is(this._value, newValue)) return; // این گارد
    // ...
}
```

اما متد `update()` این گارد را ندارد. اگر `fn` مقداری یکسان (از نظر `Object.is`) برگرداند، باز هم subscriberها notify می‌شوند:

```typescript
const count = signal({ x: 1 });
count.update(obj => obj); // reference یکسان — اما subscriberها notify می‌شوند
```

هر چند کامنت توضیح می‌دهد که این رفتار برای آرایه‌ها/اشیاء change-in-place عمدی است، اما عدم بررسی `Object.is` می‌تواند باعث اجرای بی‌دلیل Effectها شود.

**نحوه رفع**:  
گارد `Object.is()` را به `update()` اضافه کنید:

```typescript
update(fn: (current: T) => T): void {
    const oldValue = this._value;
    const next = fn(oldValue);
    if (Object.is(oldValue, next)) return; // گارد جدید
    this._value = next;
    recordStateChange(this, oldValue, next);
    this._subscribers.forEach(effectFn => {
        const priority = getEffectPriority(effectFn);
        scheduleEffect(effectFn, priority);
    });
}
```

---

## پیشنهادات ارتقا (Improvements)

### IMP-01: Lazy Initialization برای Computed

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | جلوگیری از اجرای زودهنگام computation؛ صرفه‌جویی در محاسبات درخت کامپوننت که همه branchها رندر نمی‌شوند |

**شرح**:  
در حال حاضر `Computed` در سازنده خود بلافاصله `computation()` را اجرا می‌کند و Effect داخلی را می‌سازد. برای computedهایی که ممکن است هرگز خوانده نشوند (مثلاً در شرط‌های UI)، این کار بیهوده است.

**نحوه پیاده‌سازی**:  
مثل Vue 3.4+ از Lazy Evaluation استفاده کنید — `computation()` را تا اولین `get()` به تأخیر بیندازید:

```typescript
class Computed<T> {
    private _value: T | undefined;
    private _innerSignal: Signal<T | undefined>;
    private _cleanup: (() => void) | null = null;
    private _initialized = false;

    constructor(private computation: () => T) {
        // innerSignal بدون مقدار اولیه ساخته می‌شود
        this._innerSignal = signal<T | undefined>(undefined);
    }

    get(): T {
        if (!this._initialized) {
            this._initialize();
        }
        return this._innerSignal.get() as T;
    }

    private _initialize(): void {
        this._value = this.computation();
        this._innerSignal = signal<T>(this._value as T);
        this._cleanup = effect(() => {
            const newValue = this.computation();
            if (!Object.is(newValue, this._value)) {
                this._value = newValue;
                this._innerSignal.set(newValue);
            }
        });
        this._initialized = true;
    }

    dispose(): void {
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }
        this._initialized = false;
    }
}
```

---

### IMP-02: یکپارچه‌سازی واقعی `SchedulerAdapter`

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | تکمیل Feature Scaffolding موجود؛ امکان تست‌پذیری و سفارشی‌سازی Scheduler |

**شرح**:  
همان‌طور که در BUG-02 توضیح داده شد، `SchedulerAdapter` و `configureScheduler()` تعریف شده‌اند اما هرگز در `scheduleEffect()` و `flushSync()` استفاده نمی‌شوند. این یک قابلیت ناقص است که توسعه‌دهنده را گمراه می‌کند.

**نحوه پیاده‌سازی**:  
علاوه بر رفع BUG-02 (اتصال `scheduleEffect` و `flushSync` به adapter)، یک تشخیص (guard) اضافه کنید که اگر adapter تنظیم شده، adapter جدید `isFlushing` را نیز مدیریت کند:

```typescript
export function scheduleEffect(effectFn: Function, priority: Priority = 'normal'): void {
    if (_customAdapter.current) {
        _customAdapter.current.schedule(() => {
            try { effectFn(); } catch (err) {
                console.error('[Zenith Scheduler] Error in scheduled effect:', err);
            }
        }, priority);
        return;
    }
    // منطق فعلی ...
}
```

---

### IMP-03: استخراج Context به ماژول مجزا

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | رفع circular dependency؛ بهبود testability؛ ایزوله کردن منطق context-aware |

**شرح**:  
در حال حاضر:
- `signal.ts` شامل `EffectContext`، `setEffectContextStore()`، `_getMutableContext()`، `setActiveEffect()`، `getActiveEffect()`، `setActiveCleanupRegistration()`، `registerCleanup()` است
- `effect.ts` این توابع را از `signal.ts` import می‌کند
- `signal.ts` از `effect.ts` تابع `getEffectPriority()` را import می‌کند

ایجاد یک فایل `context.ts` برای تمام APIهای context باعث تفکیک واضح لایه‌ها می‌شود.

**نحوه پیاده‌سازی**:

```typescript
// packages/state/src/context.ts
export interface EffectContext {
    activeEffect: Function | null;
    activeCleanupRegistration: ((cleanup: () => void) => void) | null;
}

// Fallback ماژول-سطح
let fallbackContext: EffectContext = {
    activeEffect: null,
    activeCleanupRegistration: null,
};

let effectContextProvider: (() => EffectContext | null) | null = null;

export function setEffectContextStore(provider: (() => EffectContext | null) | null): void {
    effectContextProvider = provider;
}

export function _getMutableContext(): EffectContext {
    if (effectContextProvider) {
        const ctx = effectContextProvider();
        if (ctx) return ctx;
    }
    return fallbackContext;
}

export function setActiveEffect(effect: Function | null): void {
    _getMutableContext().activeEffect = effect;
}

export function getActiveEffect(): Function | null {
    return _getMutableContext().activeEffect;
}
```

سپس:
- `signal.ts` فقط `context.ts` را import می‌کند (نه `effect.ts`)
- `effect.ts` فقط `context.ts` را import می‌کند (نه `signal.ts`)

---

### IMP-04: پیاده‌سازی `afterFlush` با وضعیت فعلی

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | قابلیت موجود برای اجرای callback پس از flush Scheduler کامل نیست |

**شرح**:  
در `scheduler.ts`، `afterFlush()` و `afterFlushCallbacks` تعریف شده‌اند (IMPROVEMENT-04 در کامنت‌ها). اما ساختار `afterFlushCallbacks` یک `Array<() => void>` ساده است که با `splice(0)` در خط ~۱۹۹ پاک می‌شود. اگر callbackای در حین اجرا یک callback دیگر اضافه شود، در همان flush نادیده گرفته می‌شود. این رفتار عمدی است (برای جلوگیری از re-entrancy) اما مستند نشده است.

**نحوه پیاده‌سازی**:  
یک تست unit برای این رفتار بنویسید و رفتار re-entrancy را مستند کنید. همچنین متد `afterFlush` را طوری بهبود دهید که یک تابع `dispose` (برای لغو ثبت) برگرداند:

```typescript
export function afterFlush(cb: () => void): () => void {
    afterFlushCallbacks.push(cb);
    // return a disposer
    return () => {
        const idx = afterFlushCallbacks.indexOf(cb);
        if (idx !== -1) afterFlushCallbacks.splice(idx, 1);
    };
}
```

---

### IMP-05: یکپارچه‌سازی پرچم DevTools بین ماژول‌ها

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | سازگاری و یکپارچگی بیشتر بین ماژول‌ها |

**شرح**:  
در `registry.ts`، بررسی DevTools از `(globalThis as any).__ZENITH_DEVTOOLS__` و `(globalThis as any).__ZENITH_DEV__` استفاده می‌کند (با منطق `__ZENITH_DEVTOOLS__ !== false`). در `batch.ts`، فقط `__ZENITH_DEV__ !== false` را چک می‌کند (خط ۴۲) و از `__ZENITH_DEVTOOLS__` خبری نیست. این ناهماهنگی می‌تواند باعث شود در محیطی که `__ZENITH_DEVTOOLS__` فعال است اما `__ZENITH_DEV__` خاموش است، batch warning نمایش داده نشود.

**نحوه پیاده‌سازی**:  
یک تابع کمکی یکپارچه برای بررسی DevTools ایجاد کنید:

```typescript
// packages/state/src/devtools.ts (جدید یا اضافه شده به registry.ts)
export function isDevtoolsEnabled(): boolean {
    return (
        (globalThis as any).__ZENITH_DEVTOOLS__ === true ||
        (globalThis as any).__ZENITH_DEV__ !== false
    );
}
```

و در `batch.ts` از همین تابع استفاده کنید.

---

### IMP-06: TypeScript Strictness — Branded Type برای Priority

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | ایمنی تایپ بالاتر در Scheduler و Effect |

**شرح**:  
`Priority` یک `type` ساده در `@zenith/scheduler` است (احتمالاً `'urgent' | 'normal' | 'idle'`). در `effect.ts`، `currentDefaultPriority` از نوع `Priority` است (خط ۵۹). اما `getEffectPriority` از `effectPriorityMap.get(effectFn) ?? currentDefaultPriority` استفاده می‌کند (خط ۱۷۶) که ممکن است `undefined` برگرداند. `?? currentDefaultPriority` همیشه یک مقدار پیش‌فرض می‌دهد، اما تایپ Map همچنان `Priority | undefined` است.

**نحوه پیاده‌سازی**:  
Map را با `Map<Function, Priority>` تایپ کنید (نه صرفاً `Map<Function, string>`):

هم‌چنین برای جلوگیری از عبور stringهای دلخواه، از Branded Type یا الگوی زیر استفاده کنید:

```typescript
// در scheduler
export const PRIORITY_VALUES = ['urgent', 'normal', 'idle'] as const;
export type Priority = (typeof PRIORITY_VALUES)[number];

// در effect.ts
const effectPriorityMap = new Map<Function, Priority>();
// Map.get() به‌درستی Priority | undefined برمی‌گرداند
```

این تاحدی در scheduler.ts انجام شده (PRIORITY_VALUES) اما در effect.ts map تایپ مشخصی ندارد.

---

### IMP-07: ساماندهی `effect()` خطا (Error Boundary برای Effect)

| مشخصه | مقدار |
|---|---|
| **دلیل و مزیت** | جلوگیری از سرایت خطا از یک effect به بقیه سیستم |

**شرح**:  
در `effect.ts` خط ۱۳۰-۱۴۱، وقتی `fn()` خطا می‌دهد، خطا مجدداً پرتاب می‌شود (`throw err`). این یعنی تابع `effect()` فراخوان می‌شود و می‌تواند کل برنامه را crash کند. در یک سیستم واکنش‌گرا، بهتر است خطاها در خود Effect مدیریت شوند و Effect از Dependency Graph حذف شود (بدون crash کردن برنامه).

**نحوه پیاده‌سازی**:  
مشابه Vue's `onErrorCaptured` یا Error Boundary در React، می‌توان یک handler برای خطاهای Effect تعریف کرد:

```typescript
let globalErrorHandler: ((err: unknown, effect: Function) => void) | null = null;

export function onEffectError(handler: ((err: unknown, effect: Function) => void) | null): void {
    globalErrorHandler = handler;
}

// در runEffect:
try {
    fn();
} catch (err) {
    cleanupQueue.forEach(cleanup => {
        try { cleanup(); } catch { /* ignore */ }
    });
    cleanupQueue = [];
    if (globalErrorHandler) {
        globalErrorHandler(err, runEffect);
    } else {
        console.error('[Zenith] Unhandled effect error:', err);
    }
    // به جای throw err، Effect را از گراف خارج کن
    // effectPriorityMap.delete(runEffect);
    // subscribers از طریق clean-up قبلی حذف شده‌اند
}
```

---

## نکات یکپارچگی با سایر پکیج‌ها

### ارتباط با `@zenith/scheduler`

**importها**:
- `signal.ts` خط ۲۰: `import { scheduleEffect } from '@zenith/scheduler';`
- `effect.ts` خط ۳۰: `import type { Priority } from '@zenith/scheduler';`
- `index.ts` خط ۲۳: `export type { Priority } from '@zenith/scheduler';`

**نکات**:
1. **SchedulerAdapter (BUG-02 مرتبط)**: اگر `SchedulerAdapter` به‌درستی کار کند، state می‌تواند از یک Microtask-based scheduler به یک scheduler مبتنی بر `requestAnimationFrame` یا custom implementation مهاجرت کند. این برای صحنه‌هایی مثل testing (نیاز به flush synchronous) و animation-heavy UI مفید است.
2. **Priority Queue**: سه سطح اولویت (`urgent`, `normal`, `idle`) در scheduler تعریف شده و state از آن استفاده می‌کند. Signal.set() اولویت هر Effect را از `getEffectPriority()` می‌خواند و به `scheduleEffect(effectFn, priority)` می‌دهد. این زنجیره به‌درستی کار می‌کند.
3. **Circular Dependency Cross-package**: خوشبختانه state فقط یک dependency (scheduler) دارد و scheduler به state وابسته نیست، پس circular dependency بین پکیج‌ها وجود ندارد.
4. **قابلیت flushSync**: از scheduler در state قابل دسترسی نیست (در batch.ts فقط به آن اشاره شده). برای اجرای synchronous Effectها، کاربر باید مستقیماً از `@zenith/scheduler` import کند.

### ارتباط با `@zenith/expressions`

فایل‌های state هیچ وابستگی مستقیم به پکیج expressions ندارند. اما در معماری فریم‌ورک:
- Context Expressions می‌توانند از `signal.get()` در قالب‌های reactive استفاده کنند
- متد `untrack()` برای موقعیت‌هایی که expression باید مقدار signal را بدون ایجاد وابستگی بخواند مفید است
- `computed` برای Derived State در expressions کاربرد دارد

> **توصیه**: یک لایه adapter بین state و expressions ایجاد شود تا expressions مجبور نباشند مستقیماً Signal API را فراخوانی کنند. این کار abstraktion را افزایش می‌دهد.

### ارتباط با `@zenith/runtime`

Runtime از Signalها و Effectها برای مدیریت state کامپوننت‌ها و re-render استفاده می‌کند:
- `signal` برای state محلی کامپوننت‌ها
- `effect` برای DOM updates و side effects
- `computed` برای derived state در قالب‌ها
- `Priority` برای اولویت‌بندی به‌روزرسانی‌های DOM

**نکات مهم**:
1. **Context API در SSR (BUG-22)**: `setEffectContextStore` برای SSR concurrent طراحی شده. runtime باید در `renderToString` یک provider تابع تنظیم کند که از `AsyncLocalStorage` بخواند. این integration حیاتی است و باید با تست واحد پوشش داده شود.
2. **Effect Priority در DOM Updates**: runtime باید از priorityهای مختلف استفاده کند — `'urgent'` برای navigation و state حیاتی، `'normal'` برای DOM updates معمولی، `'idle'` برای analytics و pre-render. در حال حاضر runtime این تمایز را اعمال نمی‌کند (همه از `'normal'` استفاده می‌کنند).
3. **Memory Management**: runtime باید هنگام unmount کامپوننت، dispose تمام Signalها، Effectها و Computedهای مربوطه را فراخوانی کند. در غیر این صورت WeakMap و WeakRef registry نمی‌توانند منابع را به‌درستی آزاد کنند.

---

## کیفیت کد و تست‌ها

### مستندات (Docs Quality)

| معیار | وضعیت | توضیح |
|---|---|---|
| JSDoc/TSDoc | **خوب** | اکثر توابع و کلاس‌ها مستندات کاملی به فارسی دارند |
| مستندات API | **متوسط** | index.ts فقط export دارد؛ نیاز به اسناد کاربری جداگانه |
| مستندات فارسی در کد | **مختلط** | برخی کامنت‌ها فارسی نوشته شده‌اند (مفید برای تیم فارسی‌زبان) اما در یک پروژه بین‌المللی بهتر است انگلیسی باشند یا dual-language |
| توضیح Edge Cases | **ضعیف** | مواردی مثل double execution در computed، race condition در untrack + cleanupRegistration، و عدم بررسی Object.is در update() مستند نشده‌اند |
| مستندات Deprecated API | **متوسط** | `triggerEffects` و `batch` با `@deprecated` مشخص شده‌اند اما `isBatching` و `addEffectToBatch` نیز عملاً deprecated هستند ولی مارک نشده‌اند |

**نکات منفی**:
- کامنت‌ها به صورت semi-structured با تیترهای فارسی نوشته شده‌اند (مثل "── فاز ۷: Scheduler ──") که خوانایی دارد اما از استاندارد JSDoc فاصله گرفته
- در `signal.ts` کامنت‌هایی وجود دارد که به Bug Fixها اشاره می‌کنند اما تاریخ دقیق ندارند (فقط "v1.2.2" یا "v1.2.4")
- کامنت‌های _بسیار طولانی_ (بیش از ۲۰ خط) گاهی بیشتر از خود کد حجم دارند
- برخی کامنت‌ها به جای توضیح "چرا"، صرفاً "چه" را توضیح می‌دهند که از روی کد هم قابل فهم است

### تایپ‌اسکریپت (Type Strictness)

`tsconfig.json` تنظیمات زیر را فعال کرده:

| گزینه | وضعیت | توضیح |
|---|---|---|
| `strict: true` | فعال | همه گزینه‌های strict را فعال می‌کند |
| `noImplicitAny` | فعال | ایمنی تایپ بالا |
| `strictNullChecks` | فعال | از null/undefined محافظت می‌کند |
| `noUnusedLocals` | فعال | جلوگیری از متغیرهای بلااستفاده |
| `noUnusedParameters` | فعال | جلوگیری از پارامترهای بلااستفاده |
| `noImplicitReturns` | فعال | اطمینان از return در همه مسیرها |
| `noUncheckedIndexedAccess` | فعال | ایمنی در دسترسی به آرایه/Map با `[]` |
| `noImplicitOverride` | فعال | نیاز به override صریح |
| `verbatimModuleSyntax` | **غیرفعال** | امکان import type به صورت ناصریح (ممکن است در برخی bundlerها مشکل ایجاد کند) |

**نقاط ضعف**:
1. **`(globalThis as any)`**: در چندین جا از `as any` استفاده شده (registry.ts خطوط ۹۱-۹۳، batch.ts خط ۴۲) که type safety را دور می‌زند. بهتر است از type augmentation استفاده شود:

```typescript
// globals.d.ts
declare global {
    var __ZENITH_DEVTOOLS__: boolean | undefined;
    var __ZENITH_DEV__: boolean | undefined;
}
```

2. **`Priority` type**: تعریف Priority در scheduler یک نوع اتحاد (union type) ساده است، نه یک نوع نامی (nominal/branded type). این یعنی هر stringی را می‌توان به اشتباه به توابعی که Priority می‌پذیرند پاس داد.

3. **`WeakMap<Signal<any>, number>` در registry.ts**: تایپ `Signal<any>` loose است. بهتر بود از `Signal<unknown>` یا generic با constraint استفاده شود.

4. **نبود `@internal` و visibility modifiers**: برخی توابع مثل `_getMutableContext()` و `recordStateChange()` با underscore شروع شده‌اند (قرارداد داخلی) اما TypeScript's `@internal` یا `private` استفاده نشده است. `scheduleEffect` و `flushSync` از scheduler در state مستقیماً استفاده می‌شوند اما در index.ts صادر نمی‌شوند — که درست است.

5. **`useDefineForClassFields`**: در tsconfig مقداردهی نشده. در ES2022 class fields به صورت `[[Define]]` semantic رفتار می‌کنند. اگر `useDefineForClassFields: true` نباشد (یا تنظیم نشده باشد)، class fields در TypeScript با `[[Set]]` semantic رفتار می‌کنند. این می‌تواند با subclassing مشکل ایجاد کند.

### عدم وجود تست

همان‌طور که در BUG-06 اشاره شد، هیچ فایل تستی وجود ندارد. برای یک موتور Reactivity که قلب فریم‌ورک است، این یک شکاف جدی است. حداقل تست‌های زیر ضروری هستند:

| دامنه تست | اولویت | سناریوهای کلیدی |
|---|---|---|
| Signal | **بحرانی** | get/set, Object.is equality, update, peek, untrack, subscriber cleanup, concurrent read during effect |
| Effect | **بحرانی** | execution, re-execution, cleanup queue, error handling, priority, dispose, nested effects |
| Computed | **بالا** | caching, chained computed, lazy evaluation, dispose, impure computation, circular dep detection |
| Batch/Scheduler Integration | **بالا** | automatic batching, flushSync, afterFlush, priority ordering, infinite loop protection |
| Registry | **متوسط** | signal registration, GC cleanup, stateChangeTimeline, clearRegistry ID preservation |
| SSR Context | **متوسط** | Concurrent rendering with setEffectContextStore, isolation between requests |

---

## خلاصه یافته‌ها

| دسته‌بندی | تعداد | بحرانی | بالا | متوسط | کم |
|---|---|---|---|---|---|
| **باگ (Bug)** | ۷ | ۰ | ۲ | ۳ | ۲ |
| **پیشنهاد ارتقا (Improvement)** | ۷ | — | — | — | — |
| **شکاف مستندات** | ۴ | — | — | — | — |
| **شکاف تست** | ۱ (کل پکیج) | — | ۱ | — | — |

**مهم‌ترین یافته**ها:
1. **BUG-01** (`update()` oldValue) — یک باگ قطعی در رهگیری تاریخچه تغییرات
2. **BUG-02** (SchedulerAdapter بی‌اثر) — قابلیت ناقص که توسعه‌دهنده را گمراه می‌کند
3. **BUG-06** (نبود تست) — عدم وجود هرگونه تست unit برای هسته Reactivity فریم‌ورک
4. **BUG-03** (Double computation) — اجرای دوبرابر computation در computed برای توابع ناخالص

**نمره کلی کیفیت**: **۶.۵/۱۰**  
کد از نظر ساختاری تمیز و readable است. مستندات داخلی به‌نسبت خوب هستند. اما باگ‌های جدی در `update()` و `SchedulerAdapter` و نبود کامل تست‌ها، قابلیت اطمینان را کاهش می‌دهد.
