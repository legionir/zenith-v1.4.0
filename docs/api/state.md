# Reactivity API

APIهای اصلی برای ایجاد سیگنال‌ها، افکت‌ها، محاسبات مشتق‌شده و مدیریت چرخه حیات.

---

## `signal()`

یک کانتینر واکنش‌گرا برای مقادیر ایجاد می‌کند.

### Type Signature
```typescript
function signal<T>(initialValue: T, options?: SignalOptions<T>): Signal<T>;

interface SignalOptions<T> {
  equals?: (a: T, b: T) => boolean;
  computed?: boolean;
  readonly?: boolean;
}

interface Signal<T> {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(listener: (value: T) => void): () => void;
}
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `initialValue` | `T` | ✅ | - | مقدار اولیه سیگنال |
| `options.equals` | `(a: T, b: T) => boolean` | ❌ | `Object.is` | تابع مقایسه برای تشخیص تغییر |
| `options.computed` | `boolean` | ❌ | `false` | برای استفاده داخلی در کامپوتدها |
| `options.readonly` | `boolean` | ❌ | `false` | سیگنال فقط خواندنی |

### مقدار بازگشتی
یک آبجکت `Signal<T>` با متدهای `get()`، `set()` و `subscribe()`.

### مثال‌ها
```typescript
// سیگنال ساده
const count = signal(0);
console.log(count.get()); // 0

count.set(1);
console.log(count.get()); // 1

// آپدیت با تابع
count.set(prev => prev + 1);
console.log(count.get()); // 2

// اشتراک در تغییرات
const unsubscribe = count.subscribe(value => {
  console.log('Changed:', value);
});

// سیگنال با مقایسه سفارشی
const user = signal({ name: 'Ali' }, {
  equals: (a, b) => a.name === b.name
});

// فقط خواندنی (از طریق computed)
const readOnlyCount = computed(() => count.get());
```

### استنتاج خودکار نوع
```typescript
const count = signal(0); // Signal<number>
count.set('hello'); // ❌ خطای TypeScript: string به number قابل تخصیص نیست
```

### موارد خاص
- اگر مقدار جدید با قدیمی برابر باشد (بر اساس `equals`)، هیچ اطلاع‌رسانی انجام نمی‌شود و افکت‌ها دوباره اجرا نمی‌شوند.
- متد `set` هم مقدار مستقیم می‌گیرد هم تابعی که مقدار قبلی را دریافت می‌کند و جدید را برمی‌گرداند.
- `subscribe` یک تابع پاکسازی برمی‌گرداند.

---

## `effect()`

تابعی ایجاد می‌کند که هر بار سیگنال‌های دسترسی‌یافته داخلش تغییر کنند، دوباره اجرا می‌شود.

### Type Signature
```typescript
type EffectFn = () => void | (() => void);

interface EffectOptions {
  priority?: number;
  owner?: Owner | null;
  onError?: (err: Error) => void;
}

function effect(fn: EffectFn, options?: EffectOptions): () => void;
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `fn` | `EffectFn` | ✅ | - | تابع اصلی افکت. می‌تواند یک تابع پاکسازی برگرداند. |
| `options.priority` | `number` | ❌ | `Priority.normal` | اولویت اجرا در Scheduler |
| `options.owner` | `Owner \| null` | ❌ | Owner فعلی | Owner والد برای مدیریت چرخه حیات |
| `options.onError` | `(err: Error) => void` | ❌ | - | Handler خطای اختصاصی این افکت |

### مقدار بازگشتی
یک تابع `dispose` که با فراخوانی آن، افکت متوقف و تمام منابعش پاک می‌شوند.

### مثال‌ها
```typescript
const count = signal(0);

// افکت ساده
const dispose = effect(() => {
  console.log('Count is:', count.get());
});

// افکت با تابع پاکسازی
effect(() => {
  const timer = setInterval(() => {
    console.log('Tick');
  }, 1000);

  // این تابع قبل از هر اجرای مجدد و هنگام dispose اجرا می‌شود
  return () => clearInterval(timer);
});

// افکت با اولویت بالا
effect(() => {
  document.title = `Count: ${count.get()}`;
}, { priority: Priority.high });

// افکت با مدیریت خطا
effect(() => {
  riskyOperation();
}, {
  onError: (err) => {
    console.error('Effect failed:', err);
  }
});

// توقف افکت
dispose();
```

### موارد خاص
- افکت‌ها به طور خودکار در زمان ایجاد اولین بار اجرا می‌شوند.
- تابع پاکسازی برگردانده شده، **قبل از هر اجرای مجدد** و هنگام `dispose` اجرا می‌شود.
- هر افکت یک Owner ایجاد می‌کند؛ تمام افکت‌های داخلی به عنوان فرزند ثبت می‌شوند و هنگام پاکسازی والد، همه پاک می‌شوند.

---

## `computed()`

یک سیگنال فقط خواندنی ایجاد می‌کند که مقدارش از سایر سیگنال‌ها مشتق می‌شود.

### Type Signature
```typescript
type ComputedFn<T> = () => T;

function computed<T>(fn: ComputedFn<T>, options?: SignalOptions<T>): ReadonlySignal<T>;

type ReadonlySignal<T> = Omit<Signal<T>, 'set'>;
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `fn` | `ComputedFn<T>` | ✅ | تابع محاسبه مقدار |
| `options` | `SignalOptions<T>` | ❌ | همان گزینه‌های `signal` |

### مقدار بازگشتی
یک `ReadonlySignal<T>` که فقط متد `get()` دارد و قابل نوشتن نیست.

### مثال‌ها
```typescript
const firstName = signal('Ali');
const lastName = signal('Rezaei');

// کامپوتد ساده
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
console.log(fullName.get()); // "Ali Rezaei"

// کامپوتد وابسته به کامپوتد دیگر
const nameLength = computed(() => fullName.get().length);
console.log(nameLength.get()); // 11

// استفاده در افکت
effect(() => {
  console.log('Full name changed:', fullName.get());
});

// تغییر منبع → کامپوتد به طور خودکار آپدیت می‌شود
firstName.set('Sara');
// fullName.get() اکنون "Sara Rezaei" است
```

### کامپوتد فقط خواندنی
```typescript
const double = computed(() => count.get() * 2); // ReadonlySignal<number>
double.set(10); // ❌ خطای TypeScript: set در ReadonlySignal وجود ندارد
```

### موارد خاص
- کامپوتدها **تنبل (lazy)** هستند: محاسبه فقط وقتی انجام می‌شود که کسی `get()` کند یا یک افکت به آن وابسته باشد.
- کامپوتدها فقط خواندنی هستند؛ فراخوانی `set()` خطای TypeScript می‌دهد.
- هر کامپوتد یک Owner ایجاد می‌کند و در چرخه حیات والدش قرار می‌گیرد.

---

## `createRoot()`

یک ریشه reactivity ایجاد می‌کند که تمام افکت‌ها و کامپوتدهای داخلش را می‌توان یکجا پاک کرد.

### Type Signature
```typescript
function createRoot<T>(fn: (dispose: () => void) => T): T;
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `fn` | `(dispose: () => void) => T` | ✅ | تابعی که درون ریشه اجرا می‌شود و تابع پاکسازی را دریافت می‌کند |

### مقدار بازگشتی
مقداری که از `fn` برگردانده می‌شود.

### مثال‌ها
```typescript
// ریشه ساده
const root = createRoot((dispose) => {
  const count = signal(0);

  effect(() => {
    console.log(count.get());
  });

  return { count, dispose };
});

root.count.set(1); // افکت اجرا می‌شود
root.dispose(); // تمام افکت‌ها و کامپوتدها پاک می‌شوند

// استفاده با Explicit Resource Management (using)
function testComponent() {
  using root = createRoot((dispose) => {
    const data = signal(null);
    return { data, [Symbol.dispose]: dispose };
  });

  // استفاده از root.data
} // خروج از بلوک → root به طور خودکار پاک می‌شود

// افکت با پاکسازی خودکار در createRoot
const root = createRoot((dispose) => {
  const count = signal(0);
  effect(() => {
    const timer = setInterval(() => {
      count.set(c => c + 1);
    }, 1000);
    onCleanup(() => clearInterval(timer)); // خودکار پاک می‌شود
  });
  return { count, dispose };
});

root.dispose(); // پاکسازی کامل همه چیز یکجا
```

### موارد خاص
- تمام چیزهایی که درون `createRoot` ایجاد می‌شوند، جزو فرزندان آن ریشه محسوب می‌شوند.
- فراخوانی `dispose` تمام زیرمجموعه‌ها را به صورت بازگشتی پاک می‌کند.
- اگر تابع داخلی خطا بندازد، ریشه به طور خودکار پاک می‌شود.

---

## `onCleanup()`

یک تابع پاکسازی در Owner فعال فعلی ثبت می‌کند.

### Type Signature
```typescript
function onCleanup(fn: () => void): void;
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `fn` | `() => void` | ✅ | تابعی که هنگام پاکسازی Owner اجرا می‌شود |

### مثال‌ها
```typescript
effect(() => {
  const element = document.getElementById('app');
  const handler = () => console.log('Clicked');
  element?.addEventListener('click', handler);

  // هنگام پاکسازی افکت، listener حذف می‌شود
  onCleanup(() => {
    element?.removeEventListener('click', handler);
  });
});

// در کامپوننت سفارشی
function createComponent() {
  return createRoot((dispose) => {
    const connection = openDatabase();

    onCleanup(() => {
      connection.close();
    });

    return { dispose };
  });
}
```

### موارد خاص
- اگر در بیرون از هیچ Owner فراخوانی شود، هیچ اتفاقی نمی‌افتد.
- چندین تابع پاکسازی می‌توان ثبت شوند؛ همه به ترتیب ثبت اجرا می‌شوند.
- خطای یک تابع پاکسازی، اجرای بقیه را متوقف نمی‌کند.

---

## `getOwner()` / `setOwner()`

دریافت یا تنظیم Owner فعال فعلی.

### Type Signature
```typescript
function getOwner(): Owner | null;
function setOwner(owner: Owner | null): void;

interface Owner {
  parent?: Owner | null;
  children: Set<Owner>;
  cleanup: Set<() => void>;
  disposed: boolean;
}
```

### مثال‌ها
```typescript
// دریافت Owner فعلی
const currentOwner = getOwner();

// تنظیم Owner موقت
const parent = createOwner();
setOwner(parent);
// افکت‌های اینجا فرزند parent هستند
effect(() => { /* ... */ });
setOwner(null);
```

---

## `disposeOwner()`

یک Owner و تمام زیرمجموعه‌هایش را پاک می‌کند.

### Type Signature
```typescript
function disposeOwner(owner: Owner): void;
```

### مثال‌ها
```typescript
const owner = createOwner();
setOwner(owner);
effect(() => { /* ... */ });
setOwner(null);

// پاکسازی owner و تمام افکت‌های داخلش
disposeOwner(owner);
```

### موارد خاص
- اگر Owner قبلاً پاک شده باشد، هیچ اتفاقی نمی‌افتد.
- اول تمام فرزندان پاک می‌شوند، سپس توابع پاکسازی خود Owner اجرا می‌شود.
- Owner از لیست فرزندان والدش حذف می‌شود.
