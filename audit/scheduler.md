# گزارش حسابرسی جامع Scheduler
**تاریخ**: ۱۴۰۵/۰۴/۰۹  
**پکیج**: `@zenith/scheduler` (v1.3.0)  
**حوزه**: موتور زمان‌بندی Effectها با پشتیبانی Priority Queue

---

## ساختار فایل‌ها

### `packages/scheduler/src/scheduler.ts` (۳۵۶ خط)
فایل اصلی موتور Scheduler. شامل:

| مؤلفه | خط | شرح |
|-------|-----|------|
| نوع `Priority` | ۴۵ | اتحاد 'idle' \| 'normal' \| 'urgent' |
| شیء `PRIORITY_VALUE` | ۴۷-۵۱ | نگاشت اولویت به مقدار عددی (idle=0, normal=1, urgent=2) |
| تابع `priorityValue` | ۵۶-۵۸ | تبدیل اولویت به عدد با سقوط به normal برای ورودی‌های ناشناخته |
| اینترفیس `QueuedEffect` | ۶۳-۷۲ | ساختار هر Effect در صف: تابع، اولویت، شماره ترتیب |
| متغیر `queue` | ۸۸ | `Map<Function, QueuedEffect>` — خود صف اصلی |
| شمارنده `insertSeq` | ۹۳ | شمارنده monotonic صعودی برای حفظ ترتیب ثبت |
| فلگ `isFlushing` | ۱۰۲ | محافظ re-entrancy |
| آرایه `afterFlushCallbacks` | ۱۱۵ | صف callbackهای پس از flushing |
| `flushPromise` | ۱۲۴ | ارجاع به Promise میکروتسک فعلی (با مقداردهی null) |
| ثابت `MAX_FLUSH_ITERATIONS` | ۱۳۲ | سقف ۱۰۰۰ بار تکرار حلقه اصلی |
| تابع `flushQueue` | ۱۴۷-۲۱۶ | هسته عملیاتی Scheduler |
| تابع `scheduleEffect` | ۲۳۵-۲۵۵ | API عمومی برای ثبت Effect |
| تابع `flushSync` | ۲۷۱-۲۷۴ | اجرای همزمان صف |
| توابع کمکی `hasPendingEffects` و `pendingEffectCount` و `pendingEffectsByPriority` | ۲۸۳-۳۰۳ | وضعیت‌سنجی |
| تابع `clearScheduler` | ۳۱۰-۳۱۷ | پاکسازی کامل (مخصوص تست) |
| تابع `afterFlush` | ۳۳۷-۳۳۹ | ثبت callback پس از flush |
| اینترفیس `SchedulerAdapter` | ۳۴۵-۳۴۸ | قرارداد DI برای جایگزینی Scheduler پیش‌فرض |
| شیء `_customAdapter` | ۳۵۱ | نگهدارنده Adapter جاری |
| تابع `configureScheduler` | ۳۵۳-۳۵۵ | تنظیم Adapter سفارشی |

### `packages/scheduler/src/index.ts` (۳۳ خط)
نقطه ورود عمومی پکیج. دو گروه export:

1. **API عمومی**: `scheduleEffect`، `flushSync`، `hasPendingEffects`، `pendingEffectCount`، `pendingEffectsByPriority`، `clearScheduler`، `afterFlush`، `type Priority`
2. **API DI (v1.3.0)**: `configureScheduler`، `type SchedulerAdapter`

---

## باگ‌ها و مشکلات

### B-01: SchedulerAdapter — سیم‌کشی ناقص (Dead Code) — شدت: بحرانی

**شرح**: اینترفیس `SchedulerAdapter` و تابع `configureScheduler` در v1.3.0 اضافه شده‌اند اما **در هیچ‌جای scheduler.ts مصرف نمی‌شوند**. تابع `scheduleEffect` همچنان مستقیماً از `Promise.resolve().then(flushQueue)` استفاده می‌کند و هرگز `_customAdapter.current` را نمی‌خواند. تابع `flushSync` نیز `_customAdapter` را نادیده می‌گیرد. در نتیجه کل مکانیزم DI بی‌اثر است — هر کانفیگ Adapter سفارشی نادیده گرفته می‌شود.

**محل دقیق**:
- خط ۳۵۱: تعریف `_customAdapter` — فقط تعریف شده، هیچ‌جا خوانده نشده
- خط ۳۵۳-۳۵۵: `configureScheduler` — مقدار را می‌نویسد اما کسی نمی‌خواند
- خط ۲۵۲-۲۵۳: `scheduleEffect` — باید قبل از این خط `_customAdapter` را چک کند
- خط ۲۷۳: `flushSync` — باید `_customAdapter` را چک کند

**نحوه رفع**: پیش از fallback به میکروتسک پیش‌فرض، `_customAdapter.current` را بررسی کنید.

**کد پیشنهادی**:

```typescript
export function scheduleEffect(effectFn: Function, priority: Priority = 'normal'): void {
  const existing = queue.get(effectFn);
  if (existing) {
    if (priorityValue(priority) > priorityValue(existing.priority)) {
      existing.priority = priority;
    }
  } else {
    queue.set(effectFn, { fn: effectFn, priority, seq: insertSeq++ });
  }

  if (!isFlushing && !flushPromise) {
    const adapter = _customAdapter.current;
    if (adapter) {
      adapter.schedule(flushQueue, priority);
      // توجه: flushPromise را باید به‌گونه‌ای مدیریت کرد
      // (یا adapter را در flushQueue هم چک کرد)
    } else {
      flushPromise = Promise.resolve().then(flushQueue);
    }
  }
}

export function flushSync(): void {
  if (isFlushing) return;
  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.flush();
  } else {
    flushQueue();
  }
}
```

> **نکته**: با Adapter سفارشی، `flushPromise` مدیریت درستی نمی‌شود — Adapter ممکن است از مکانیزم غیر Promise استفاده کند. باید تصمیم معماری اتخاذ شود: آیا `_customAdapter` کل Scheduler را جایگزین می‌کند (و در نتیجه queue و isFlushing هم در اختیار Adapter است) یا تنها لایه زمان‌بندی (scheduling) را replace می‌کند؟

---

### B-02: afterFlush — عدم بازگشت Disposer — شدت: بالا

**شرح**: تابع `afterFlush` یک callback را به آرایه `afterFlushCallbacks` اضافه می‌کند اما **هیچ راهی برای حذف آن callback به طور خاص وجود ندارد**. تنها راه‌ها `clearScheduler()` (که همه چیز را پاک می‌کند) یا دستکاری مستقیم آرایه (شکستن encapsulation) است. در کامپوننت‌های داینامیک که repeatedly mount/unmount می‌شوند، این نشتی حافظه ایجاد می‌کند.

**محل دقیق**: خطوط ۳۳۷-۳۳۹

**شدت**: بالا — در سناریوهای SPA با کامپوننت‌های موقت، afterFlush callbackها پس از unmount کامپوننت همچنان در آرایه باقی می‌مانند و اجرا می‌شوند.

**نحوه رفع**: تابع `afterFlush` باید یک disposer function برگرداند.

**کد پیشنهادی**:

```typescript
export function afterFlush(cb: () => void): () => void {
  afterFlushCallbacks.push(cb);
  return () => {
    const idx = afterFlushCallbacks.indexOf(cb);
    if (idx !== -1) afterFlushCallbacks.splice(idx, 1);
  };
}
```

---

### B-03: priorityValue — سقوط خاموش (Silent Fallback) — شدت: متوسط

**شرح**: اگر یک Priority نامعتبر (مثلاً `'medium'` یا `'critical'`) به `scheduleEffect` ارسال شود، `priorityValue` آن را به `PRIORITY_VALUE.normal` (یعنی ۱) تبدیل می‌کند. این سقوط خاموش به این معناست که یک تایپو در کد کاربر یا حتی در کدهای داخلی، هرگز خطایی تولید نمی‌کند و Effect با اولویت ناخواسته (اما functional) اجرا می‌شود. در زمان دیباگ، این می‌تواند ساعتها سردرگمی ایجاد کند.

**محل دقیق**: خطوط ۵۶-۵۸ و خط ۴۸ (`PRIORITY_VALUE`)

**شدت**: متوسط — باعث کرش نمی‌شود اما رفتار نادرست اولویت‌بندی ایجاد می‌کند.

**نحوه رفع**: اضافه کردن اعتبارسنجی در زمان development (می‌توان از assert یا strict mode استفاده کرد):

```typescript
export type Priority = 'idle' | 'normal' | 'urgent';

const PRIORITY_VALUES: Record<string, number | undefined> = {
  idle: 0,
  normal: 1,
  urgent: 2,
};

function priorityValue(p: Priority): number {
  const v = PRIORITY_VALUES[p];
  if (v === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Zenith Scheduler] Unknown priority "${String(p)}". Falling back to "normal".`);
    }
    return PRIORITY_VALUES.normal!;
  }
  return v;
}
```

---

### B-04: بلوک `if (hitMaxIterations)` خالی — شدت: پایین

**شرح**: در خطوط ۲۰۶-۲۱۰ یک بلوک `if` با بدنه کاملاً خالی وجود دارد (فقط یک کامنت). این dead code خوانایی را کاهش می‌دهد و نگهداری را دشوارتر می‌کند. همچنین کامنت داخل بلوک می‌گوید "صف قبلاً clear شد" — که صدق می‌کند، اما چرا بلوک خالی نگه داشته شده؟

**محل دقیق**: خطوط ۲۰۶-۲۱۰

**نحوه رفع**: حذف بلوک `if-else` و نگه‌داشتن فقط `queue.clear()` بدون شرط (چون در هر دو مسیر صف خالی است):

```typescript
} finally {
  isFlushing = false;
  flushPromise = null;

  const cbs = afterFlushCallbacks.splice(0);
  for (const cb of cbs) {
    try { cb(); } catch (e) { console.error('[Scheduler] afterFlush error:', e); }
  }

  queue.clear(); // redundant but explicit cleanup
}
```

---

### B-05: دسترسی‌پذیری (Accessibility) پس از break — احتمال شرط مسابقه (Race Condition) — شدت: پایین

**شرح**: هنگامی که `hitMaxIterations` true می‌شود و `break` اجرا می‌گردد، `isFlushing` همچنان true است. سپس `isFlushing = false` در `finally` اجرا می‌شود. اما بین `break` و `finally`، هیچ Effect دیگری نمی‌تواند run کند (همه در یک execution context هستند). این باگ نیست اما از منظر robustness، تکیه بر finally برای پاکسازی state شکننده است — اگر استثنایی از `queue.clear()` پرتاب شود (بسیار نامحتمل)، `isFlushing` هرگز false نمی‌شود. اگر `queue.clear()` می‌توانست خطا دهد، Scheduler به طور کامل قفل می‌شد.

**محل دقیق**: خطوط ۱۶۲-۱۷۲

**نحوه رفع**: اگرچه عملاً غیرممکن است، برای defensive programming می‌توان:
```typescript
queue.clear();
hitMaxIterations = true;
break;
```

---

### B-06: Overflow شمارنده `insertSeq` — شدت: پایین (تئوریک)

**شرح**: متغیر `insertSeq` به طور نامحدود افزایش می‌یابد. در JavaScript، `Number` از نوع IEEE-754 double است با `Number.MAX_SAFE_INTEGER === 9_007_199_254_740_991`. برای رسیدن به این مقدار در یک برنامه زنده با نرخ ۱ میلیون Effect بر ثانیه، حدود ۲۸۵ سال زمان نیاز است. عملاً غیرممکن اما از منظر طراحی، overflow تدریجی می‌تواند ترتیب را در اعداد نزدیک به `MAX_SAFE_INTEGER` مختل کند (دقت کاهش می‌یابد).

**محل دقیق**: خط ۹۳ (تعریف) و خط ۲۴۶ (افزایش)

**نحوه رفع**: نیاز به رفع عملی ندارد. برای robustness می‌توان پس از رسیدن به یک حد، seqها را normalize کرد:
```typescript
if (insertSeq >= Number.MAX_SAFE_INTEGER - 1) {
  // بازنشانی seqها — تمام Effectهای موجود را normalize کن
  // (در عمل هرگز رخ نمی‌دهد)
}
```

---

### B-07: تایپ ناایمن `Function` — شدت: پایین

**شرح**: در اینترفیس `QueuedEffect` (خط ۶۴) و پارامتر `effectFn` (خط ۲۳۵) از نوع `Function` استفاده شده. این نوع هیچ محدودیتی روی signature اعمال نمی‌کند — یک تابع با هر تعداد پارامتر یا نوع بازگشتی می‌تواند به عنوان Effect ثبت شود. این برخلاف فرهنگ TypeScript است و امنیت type system را کاهش می‌دهد.

**نحوه رفع**: استفاده از `() => void` (یا `(...args: unknown[]) => void` در صورت نیاز به پارامتر):

```typescript
interface QueuedEffect {
  fn: () => void;
  priority: Priority;
  seq: number;
}

export function scheduleEffect(effectFn: () => void, priority: Priority = 'normal'): void {
```

---

## پیشنهادات ارتقا

### E-01: پیاده‌سازی صف اولویت واقعی

**وضعیت فعلی**: هر iteration از حلقه flush، تمام entries Map را به آرایه تبدیل می‌کند (`Array.from(queue.values())`)، سپس با `sort()` (O(n log n)) مرتب می‌کند، سپس صف را `clear()` می‌کند. این یعنی در هر iteration هزینه کامل sort پرداخت می‌شود.

**پیشنهاد**: پیاده‌سازی Binary Heap (Priority Queue واقعی) با O(log n) برای insert و O(1) برای دسترسی به بالاترین اولویت. اگر تعداد Effectها کم است (زیر ۵۰)، روش فعلی به دلیل سربار DOM (Document Object Model) Heap قابل قبول است — اما برای مقیاس بزرگتر، Heap عملکرد بهتری دارد.

```typescript
// ساختار پیشنهادی — Binary Max-Heap
class PriorityQueue {
  private heap: QueuedEffect[] = [];
  // ... insert, extractMax, size, clear
}
```

### E-02: یکپارچه‌سازی SchedulerAdapter

**وضعیت فعلی**: `_customAdapter` تعریف شده اما استفاده نمی‌شود (B-01).

**پیشنهاد**: تصمیم معماری اتخاذ شود:
- **گزینه الف**: Adapter کل Scheduler را جایگزین کند — `scheduleEffect` و `flushSync` و `flushQueue` همه به Adapter delegates کنند و queue داخلی برای Adapterها optional باشد.
- **گزینه ب**: Adapter تنها لایه زمان‌بندی (scheduling primitive) را جایگزین کند — `Promise.resolve().then(...)` با `requestAnimationFrame`، `queueMicrotask`، `setTimeout`، یا `requestIdleCallback` جایگزین شود. queue و flushQueue منطق یکسانی دارند.

گزینه ب ساده‌تر و low-risk است و با معماری فعلی سازگارتر.

### E-03: افزودن disposer به afterFlush

**وضعیت فعلی**: `afterFlush` `void` برمی‌گرداند (B-02).

**پیشنهاد**: برگرداندن `() => void` برای حذف callback، مطابق کد ارائه شده در B-02.

### E-04: مکانیزم Debug/Trace در Scheduler

**پیشنهاد**: افزودن hook‌های debug اختیاری برای tracing:
```typescript
export interface SchedulerHooks {
  onEffectScheduled?: (effect: () => void, priority: Priority) => void;
  onEffectExecuted?: (effect: () => void, priority: Priority, durationMs: number) => void;
  onFlushStart?: () => void;
  onFlushEnd?: (effectsCount: number, durationMs: number) => void;
  onError?: (effect: () => void, error: unknown) => void;
}
```
این به ویژه برای DevTools و profiler ارزشمند است.

### E-05: افزودن `scheduleMicrotask` به جای استفاده مستقیم از Promise

**پیشنهاد**: به جای `Promise.resolve().then(fn)` از `queueMicrotask(fn)` استفاده شود — این API اختصاصی برای همین منظور است، سربار کمتری دارد، و قصد معنایی واضح‌تری را منتقل می‌کند.

```typescript
if (!isFlushing && !flushPromise) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(flushQueue);
    flushPromise = Promise.resolve(); // فقط برای compatibility
  } else {
    flushPromise = Promise.resolve().then(flushQueue);
  }
}
```

### E-06: محدودیت تعداد Effectها در هر iteration

**پیشنهاد**: اضافه کردن یک MAX_EFFECTS_PER_ITERATION برای جلوگیری از اجرای هزاران Effect در یک iteration:

```typescript
const MAX_EFFECTS_PER_ITERATION = 500;
// در sort:
const effects = Array.from(queue.values())
  .sort(/* ... */)
  .slice(0, MAX_EFFECTS_PER_ITERATION);
```

این از blocking طولانی event loop جلوگیری می‌کند و Scheduler را time-slicing-ready می‌کند.

---

## نکات یکپارچگی با state (Effect Execution)

### تعامل Scheduler با Signal/Effect System

Scheduler لایه زمان‌بندی Effectها را مدیریت می‌کند. تعامل آن با state system به شرح زیر است:

1. **زمان ثبت Effect**: وقتی یک Signal تغییر می‌کند، state system `scheduleEffect(effectFn, priority)` را فراخوانی می‌کند. این Effect در queue ثبت و یک میکروتسک برنامه‌ریزی می‌شود.

2. **زمان اجرا**: در میکروتسک، `flushQueue` تمام Effectهای صف را بر اساس اولویت (urgent > normal > idle) و سپس ترتیب ثبت اجرا می‌کند.

3. **تضمین‌ها**:
   - هر Effect حداکثر یک بار در هر میکروتسک اجرا می‌شود (Map از تکرار جلوگیری می‌کند).
   - خطای یک Effect بقیه را متوقف نمی‌کند (try/catch مجزا).
   - اولویت‌بندی ترتیب اجرا را تعیین می‌کند اما **هیچ Effectی را حذف نمی‌کند**.
   - اگر Effectی در حین flushing Effect جدیدی schedule کند، در همان flush پردازش می‌شود (تا حداکثر ۱۰۰۰ بار).

4. **نقص در یکپارچگی**:
   - **عدم پشتیبانی از Computed chain با اولویت متفاوت**: اگر یک Computed با priority 'idle' باشد اما Effect وابسته به آن 'urgent' باشد، Computed با اولویت Effect والد اجرا می‌شود (ویا برعکس). این نیاز به تحلیل dependency graph دارد.
   - **عدم تشخیص circular dependency**: اگر Effect A, Effect B را schedule کند و Effect B, Effect A را، تا ۱۰۰۰ iteration اجرا می‌شوند و سپس صف پاک می‌شود — اما کاربر اطلاعی از circular dependency نمی‌یابد.
   - **عدم اولویت‌بندی بر اساس عمق وابستگی**: Effectها بر اساس اولویت صریح اولویت‌بندی می‌شوند، نه بر اساس جایگاهشان در گراف وابستگی. یک Effect عمیق (deeply nested computed) ممکن است قبل از Effect والد اجرا شود.

5. **ریسک starvation**: اگر به طور مداوم Effectهای 'urgent' ثبت شوند، Effectهای 'idle' هرگز اجرا نمی‌شوند. راه‌حل: اضافه کردن fairness mechanism — بعد از N بار اجرای urgent، یک idle را مجبور به اجرا کنید.

### توصیه‌های یکپارچگی

- **یکسان‌سازی priority mapping**: state system و scheduler هر دو باید از یک enum Priority استفاده کنند — نه تبدیل inline.
- **افزودن scheduled effect metadata**: برای دیباگ، هر Effect می‌تواند برچسب cause (مثلاً `signal X set by Y`) داشته باشد.
- **افزودن API برای await کردن flush**: در تست‌ها و SSR، نیاز به await روی flush داریم. اگر `flushPromise` عمومی شود، می‌توان `await flushPromise` کرد.

---

## کیفیت کد

### نقاط قوت

1. **مستندسازی کامل**: کامنت‌های جامع به فارسی با توضیح فلسفه و مکانیزم هر بخش. مثال‌های واضح از اولویت‌بندی.
2. **جلوگیری از re-entrancy**: پرچم `isFlushing` به درستی از flush همزمان جلوگیری می‌کند.
3. **انزوای خطا**: هر Effect در try/catch مجزا اجرا می‌شود — خطای یک Effect بقیه را متوقف نمی‌کند.
4. **شفافیت API**: نام‌گذاری توابع واضح و expressive است (`flushSync`, `hasPendingEffects`, `pendingEffectCount`).
5. **محافظت در برابر infinite loop**: محدودیت ۱۰۰۰ iteration با clear اجباری صف.

### نقاط ضعف

1. **SchedulerAdapter مرده (Dead Code)**: مهم‌ترین مشکل کیفی. یک Feature کامل (۳۰ خط کد) اضافه شده که کار نمی‌کند. این نشان‌دهنده فقدان تست integration است.

2. **ناهماهنگی در مدیریت حالت (State Management)**:
   - `queue` یک Map است اما `clearScheduler` آن را `clear()` می‌کند و `flushQueue` تازه‌های آن را می‌گیرد — یک نوع داده (Map) با دو سیاست مدیریت. Could یک Queue یا Ring Buffer تمیزتر باشد.
   - `flushPromise` در `scheduleEffect` ست می‌شود (خط ۲۵۳) و در `flushQueue` به null تنظیم می‌شود (خط ۱۹۴) — اما اگر `Promise.resolve().then(flushQueue)` هرگز اجرا نشود (مثلاً event loop مسدود شده باشد)، `flushPromise` تا ابد non-null می‌ماند و Effectهای جدید microtask دریافت نمی‌کنند.

3. **حذف‌های اضافی (Redundant Operations)**:
   - `queue.clear()` در خط ۲۱۳ در else: صف در این نقطه (پس از while که با queue.size === 0 خارج شده) قطعاً خالی است. این clear اضافی است و خواننده را سردرگم می‌کند.
   - `queue.clear()` در خط ۱۶۹: کافی است اما پس از آن `break` می‌کنیم — آیا بهتر نیست `return` کنیم تا از اجرای finally زودتر؟

4. **بلوک if خالی**: خطوط ۲۰۶-۲۱۰ یک if با بدنه خالی است که فقط کامنت دارد. این یک anti-pattern است.

5. **عدم یکپارچگی type safety**:
   - `Function` به جای `() => void`
   - `afterFlush` callback تایپ `() => void` دارد (درست) اما `QueuedEffect.fn` از نوع `Function` (نادرست)

6. **API سطح پایین برای تست**:
   - `pendingEffectsByPriority` در هر بار فراخوانی O(n) است. برای یک debug API قابل قبول است اما برای تست‌های مکرر ناکارآمد.
   - `clearScheduler` یک reset کامل است — نمی‌توان Effect خاصی را حذف کرد یا اولویت آن را تغییر داد.

7. **نبود متادیتا برای دیباگ**: هیچ راهی برای فهمیدن اینکه یک Effect متعلق به کدام Signal یا کامپوننت است وجود ندارد. در DevTools، ردیابی منبع یک Effect غیرممکن است.

8. **نبود Pure Function**: `flushQueue` یک تابع impure با عوارض جانبی گسترده (تغییر queue, isFlushing, flushPromise, afterFlushCallbacks) است. برای افزایش testability، می‌توان stateهای جانبی را در یک closure یا class محصور کرد.

### توصیه‌های کیفی

| ردیف | توصیه | اولویت |
|------|-------|--------|
| ۱ | تثبیت SchedulerAdapter (یا حذف آن اگر roadmap تغییر کرده) | بحرانی |
| ۲ | افزودن disposer به afterFlush | بالا |
| ۳ | جایگزینی type Function با () => void | بالا |
| ۴ | حذف بلوک if خالی و clear اضافی | متوسط |
| ۵ | افزودن validation برای Priority (در development mode) | متوسط |
| ۶ | مهاجرت به class-based Scheduler با state کپسوله‌شده | متوسط |
| ۷ | افزودن مکانیزم fairness بین اولویت‌ها | پایین |
| ۸ | افزودن metadata به QueuedEffect برای دیباگ | پایین |

### امتیاز نهایی کیفیت کد: **۶.۵ از ۱۰**

کد خواناتر و خوش‌ساختارتر از میانگین پروژه‌های مشابه است و مستندسازی عالی‌ای دارد. باگ بحرانی SchedulerAdapter (Dead Code) امتیاز را کاهش می‌دهد. اگر این باگ رفع شود و type safety بهبود یابد، امتیاز به ۸.۵ می‌رسد.

---

## خلاصه

Scheduler یک مؤلفه حیاتی و نسبتاً تمیز است.弱点 اصلی:
1. **بحرانی**: SchedulerAdapter کار نمی‌کند — مکانیزم DI بی‌اثر است.
2. **بالا**: afterFlush callbackها قابل حذف نیستند — نشتی حافظه در سناریوهای داینامیک.
3. **متوسط**: type safety ناقص (Function) و validation ضعیف Priority.
4. **پایین**: dead code جزئی و redundant operations.

مستندات فنی و کامنت‌ها در سطح عالی‌ای هستند و فلسفه طراحی به خوبی توضیح داده شده است. با رفع باگ بحرانی DI و بهبودهای کیفی ذکر شده، این پکیج می‌تواند استاندارد بالایی داشته باشد.
