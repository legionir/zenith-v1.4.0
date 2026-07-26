# Scheduler API

سیستم زمان‌بندی و اولویت‌بندی اجرای افکت‌ها و تسک‌های ناهمزمان.

---

## `Priority`

سطوح اولویت استاندارد برای تسک‌ها.

### Type Signature
```typescript
enum Priority {
  urgent = 0,
  high = 1,
  normal = 2,
  low = 3,
  idle = 4
}
```

### توضیح سطوح
| سطح | مقدار | کاربرد |
|---|---|---|
| `urgent` | 0 | عملیات بحرانی که باید فوراً اجرا شوند |
| `high` | 1 | آپدیت‌های مهم UI مثل تغییر وضعیت |
| `normal` | 2 | افکت‌های معمولی (پیش‌فرض) |
| `low` | 3 | عملیات غیرضروری مثل پیش‌بارگذاری |
| `idle` | 4 | کارهای پس‌زمینه که فقط وقتی سیستم بیکار است اجرا شوند |

---

## `schedule()`

یک تسک را برای اجرای بعدی در صف زمان‌بندی قرار می‌دهد.

### Type Signature
```typescript
function schedule(
  fn: () => void,
  priority: number = Priority.normal,
  disposed?: () => boolean
): void;
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `fn` | `() => void` | ✅ | - | تابعی که باید اجرا شود |
| `priority` | `number` | ❌ | `Priority.normal` | اولویت اجرا |
| `disposed` | `() => boolean` | ❌ | - | تابعی که قبل از اجرا بررسی می‌کند آیا تسک منقضی شده |

### مثال‌ها
```typescript
import { schedule, Priority } from '@zenith/scheduler';

// تسک با اولویت معمولی
schedule(() => {
  console.log('Normal priority task');
});

// تسک با اولویت بالا
schedule(() => {
  updateCriticalUI();
}, Priority.high);

// تسک با بررسی منقضی شدن
let cancelled = false;
schedule(() => {
  doSomething();
}, Priority.normal, () => cancelled);

// لغو تسک
cancelled = true; // تسک قبل از اجرا از صف حذف می‌شود
```

---

## `flushSync()`

تمام تسک‌های در صف را به صورت همزمان فوراً اجرا می‌کند.

### Type Signature
```typescript
function flushSync(): void;
```

### مثال‌ها
```typescript
import { signal, effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

const count = signal(0);
let rendered = 0;

effect(() => {
  count.get();
  rendered++;
});

count.set(1);
// تا اینجا افکت هنوز اجرا نشده (در صف است)

flushSync();
// حالا افکت اجرا شده
console.log(rendered); // 2
```

### موارد خاص
- در حالت عادی از این تابع زیاد استفاده نکنید؛ می‌تواند باعث کاهش عملکرد شود.
- بیشتر برای تست‌ها و سناریوهای خاص که نیاز به اجرای فوری دارند مناسب است.

---

## `nextTick()`

یک تابع را بعد از اتمام چرخه فعلی اجرای افکت‌ها قرار می‌دهد.

### Type Signature
```typescript
function nextTick(fn: () => void): void;
```

### مثال‌ها
```typescript
import { nextTick } from '@zenith/scheduler';

// اجرا بعد از تمام شدن آپدیت‌های فعلی DOM
nextTick(() => {
  const element = document.getElementById('list');
  console.log('DOM updated, element height:', element?.offsetHeight);
});

// استفاده با Promise
await new Promise<void>(resolve => nextTick(resolve));
console.log('All pending effects executed');
```

---

## مکانیزم Aging (افزایش اولویت تدریجی)

Scheduler از مکانیزم Aging برای جلوگیری از **گرسنگی (Starvation)** استفاده می‌کند:

- هرچه یک تسک بیشتر در صف منتظر بماند، اولویت موثرش به طور خودکار افزایش می‌یابد.
- نرخ افزایش: هر ثانیه ۰.۵ واحد اولویت.
- این تضمین می‌کند که حتی تسک‌های با اولویت پایین در نهایت اجرا می‌شوند.

### مثال رفتار
```typescript
// این تسک اولویت پایینی دارد
schedule(() => console.log('Low priority'), Priority.low);

// اگر تسک‌های urgent مدام اضافه شوند، این تسک
// با گذشت زمان اولویتش بالا می‌رود و اجرا می‌شود
```

---

## محدودیت اجرا

- حداکثر `100` تکرار در هر چرخه flush (قبلاً ۱۰۰۰ بود).
- اگر به این حد برسد، هشداری در کنسول نمایش داده می‌شود:
  ```
  [Zenith] Maximum flush iterations reached — possible infinite loop
  ```
- تسک‌هایی که قبل از اجرا `disposed` شده باشند، از صف حذف می‌شوند و اجرا نمی‌شوند.
