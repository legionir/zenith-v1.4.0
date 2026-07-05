# گزارش حسابرسی پکیج `events`
**نسخه:** v1.3.0 | **بسته:** `@zenith/events`

---

## ۱. خلاصه پکیج

پکیج `events` موتور Event Delegation فریم‌ورک Zenith را پیاده‌سازی می‌کند. این پکیج مسئول مدیریت یکسان رویدادهای DOM از طریق یک listener واحد در سطح document (یا root دلخواه) با پشتیبانی از modifierهای متنوع (prevent, stop, self, key-based modifiers) و سیستم ثبت modifierهای سفارشی است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/delegation.ts` | ~۲۳۰ | موتور delegation اصلی، کش binding با WeakMap، مدیریت debounce/throttle |
| `src/modifiers.ts` | ~۳۴۰ | تجزیه binding، اعمال modifierهای رفتاری، سیستم ثبت modifier سفارشی |
| `src/timing-modifiers.ts` | ~۸۰ | debounce و throttle برای modifierهای زمانی |
| `src/index.ts` | ~۳۵ | re-export عمومی |

---

## ۳. باگ‌ها و مشکلات

### BUG-EVT-01: عدم حذف listener در `clearBindingCache`
- **شدت:** متوسط
- **محل:** `src/delegation.ts`
- **شرح:** تابع `clearBindingCache` کش WeakMap را پاک می‌کند اما listenerهای ثبت‌شده روی `delegationRoot` را حذف نمی‌کند. در سناریوی HMR، این می‌تواند باعث ثبت multiple listeners و memory leak شود.
- **نحوه رفع:** نگهداری لیست listenerهای ثبت‌شده و حذف آن‌ها:

```typescript
const _activeListeners = new Map<string, EventListener>();
let _currentRoot: EventTarget | null = null;

export function clearBindingCache(): void {
  // حذف listenerهای قبلی
  if (_currentRoot && _activeListeners.size > 0) {
    for (const [eventType, listener] of _activeListeners) {
      _currentRoot.removeEventListener(eventType, listener);
    }
    _activeListeners.clear();
  }
  _bindingCache = new WeakMap();
  _timedHandlerCache.clear();
  _currentRoot = null;
}
```

### BUG-EVT-02: `delegatedHandler` ارجاع به closure قدیمی
- **شدت:** بالا
- **محل:** `src/delegation.ts` – حلقه‌ی ثبت `addEventListener`
- **شرح:** در حلقه‌ای که برای هر رویداد listener ثبت می‌کند، اگر `DELEGATED_EVENTS` شامل رویدادهای تکراری یا تغییرناپذیر باشد، `delegatedHandler` ممکن است از متغیرهای به‌روز (مانند `actionAttribute`) استفاده نکند.
- **نحوه رفع:** اطمینان از اینکه هر listener `actionAttribute` را از طریق closure مجزا دریافت می‌کند:

```typescript
for (const eventType of DELEGATED_EVENTS) {
  delegationRoot.addEventListener(eventType, (e: Event) => {
    delegatedHandler(e, eventType, actionAttribute);
  });
}
```

(این issue در کد فعلی تا حدی مدیریت شده، اما تست دقیق‌تر نیاز دارد.)

### BUG-EVT-03: `getInputType` در `splitActionArgs` ناقص
- **شدت:** کم
- **محل:** `src/delegation.ts`
- **شرح:** تابع `splitActionArgs` که برای استخراج آرگومان‌های اکشن از attribute استفاده می‌شود، ممکن است فرمت‌های quote مختلف (مانند `'` و `"`) را به درستی مدیریت نکند.
- **نحوه رفع:** استفاده از regex قوی‌تر برای جداسازی آرگومان‌ها:

```typescript
export function splitActionArgs(raw: string): string[] {
  // پشتیبانی از هر دو نوع quote
  const args: string[] = [];
  const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    args.push(match[0].replace(/^["']|["']$/g, ''));
  }
  return args;
}
```

### BUG-EVT-04: `.once` modifier احتمال نشت حافظه
- **شدت:** کم
- **محل:** `src/timing-modifiers.ts`
- **شرح:** modifier `.once` بعد از یک بار اجرا، اثر خود را از دست می‌دهد اما ممکن است کش `_timedHandlerCache` همچنان ارجاع به handler قدیمی را نگه دارد.
- **نحوه رفع:** پاکسازی کش پس از اجرای `once`:

```typescript
// در timing-modifiers.ts
export function applyTimingModifiers(/*...*/): (() => void) | void {
  if (modifiers.includes('once') && !_onceExecuted) {
    _onceExecuted = true;
    const wrapped = (...args: any[]) => {
      handler(...args);
      _onceExecuted = false; // بازنشانی برای استفاده مجدد
      // پاکسازی از کش
      timedHandlerCache.delete(cacheKey);
    };
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-EVT-01: افزودن `passive` modifier
- **دلیل:** بهبود عملکرد رویدادهای لمسی/اسکرول با استفاده از `{ passive: true }`.
- **پیاده‌سازی:**

```typescript
// در delegation.ts
if (modifiers.includes('passive')) {
  // listener باید با passive option ثبت شود
  // نیاز به بازطراحی نحوه ثبت listener
}
```

### IMP-EVT-02: افزودن `.outside` modifier
- **دلیل:** قابلیت تشخیص کلیک بیرون از یک المنت (برای modal/dropdown).
- **پیاده‌سازی:**

```typescript
// در custom modifier registry
registerEventModifier('outside', (event, modifiers, element) => {
  if (event.target === element || element.contains(event.target as Node)) {
    return false; // prevent execution if click is inside
  }
  return true;
});
```

### IMP-EVT-03: سیستم کش هوشمندتر با `WeakRef`
- **دلیل:** جلوگیری از نشت حافظه هنگام حذف DOM elements.
- **پیاده‌سازی:** استفاده از `FinalizationRegistry` برای پاکسازی خودکار کش:

```typescript
const _bindingCleanup = new FinalizationRegistry((key: string) => {
  _bindingCache.delete(key);
});
```

### IMP-EVT-04: نوع‌دهی دقیق‌تر `DelegatedEventName`
- **دلیل:** نوع `DelegatedEventName` فقط ۱۰ رویداد را پشتیبانی می‌کند. افزودن رویدادهای بیشتر (مثل `dblclick`, `contextmenu`, `wheel`) به توسعه‌پذیری کمک می‌کند.
- **پیاده‌سازی:** افزودن `dblclick`، `contextmenu`، `wheel` به `DELEGATED_EVENTS` (با توجه به bubble شدن).

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime** | `Zen.start()` گزینه‌ی `delegationRoot` را به `initEventDelegation` پاس می‌دهد. | ✅ درست |
| **actions** | `getAction` برای یافتن handler رویداد استفاده می‌شود. | ✅ درست |
| **components** | Delegation روی Shadow DOM روت‌ها از طریق `delegationRoot` قابل تنظیم. | ✅ متوسط |

---

## ۶. نتیجه‌گیری کلی

پکیج `events` یکی از خوب‌طراحی‌شده‌ترین بخش‌های فریم‌ورک است. سیستم custom modifier registry با `registerEventModifier` معماری توسعه‌پذیری عالی ایجاد کرده است. مهم‌ترین مشکلات آن مربوط به cleanup در HMR و عدم مدیریت صحیح حذف listenerهاست.

**امتیاز کلی: ۸/۱۰** (معماری قوی، نیاز به بهبود cleanup)
