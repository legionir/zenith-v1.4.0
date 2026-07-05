# گزارش حسابرسی پکیج `components`
**نسخه:** v1.3.0 | **بسته:** `@zenith/components`

---

## ۱. خلاصه پکیج

پکیج `components` سیستم کامپوننت‌های Light DOM فریم‌ورک Zenith را پیاده‌سازی می‌کند. از Component Registry، پردازش slotها، lazy loading با حافظه‌ی موقت (TTL+maxSize) و کامپایل یکباره‌ی expressionهای prop تشکیل شده است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/component-registry.ts` | ~۸۰ | ثبت و بازیابی کامپوننت‌ها با `Map<string, ComponentDefinition>` |
| `src/async-loader.ts` | ~۱۲۰ | بارگذاری异步 کامپوننت با cache TTL/maxSize + errorCache |
| `src/processor.ts` | ~۲۲۰ | پردازش slot، کامپایل یکباره prop expression |
| `src/index.ts` | ~۱۵ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-COM-01: نبود `FinalizationRegistry` برای پاکسازی خودکار کامپوننت‌های حذف‌شده
- **شدت:** متوسط
- **محل:** `src/component-registry.ts`
- **شرح:** هنگام حذف یک کامپوننت از DOM، هیچ مکانیزم خودکاری برای آزادسازی ارجاعات درون `componentRegistry` و حذف effectهای فعال وجود ندارد. این می‌تواند در طولانی‌مدت به نشت حافظه منجر شود.
- **نحوه رفع:** افزودن lifecycle hook `disconnectedCallback` یا استفاده از `MutationObserver`:

```typescript
export function trackComponentLifecycle(
  element: HTMLElement,
  componentName: string,
  cleanup: () => void,
): void {
  const observer = new MutationObserver(() => {
    if (!element.isConnected) {
      cleanup();
      observer.disconnect();
    }
  });
  observer.observe(element.parentNode ?? document.body, {
    childList: true,
  });
}
```

### BUG-COM-02: عدم مدیریت race condition در `async-loader`
- **شدت:** بالا
- **محل:** `src/async-loader.ts`
- **شرح:** در بارگذاری async کامپوننت، اگر کامپوننت خیلی سریع حذف شود و دوباره اضافه شود، ممکن است دو درخواست بارگذاری همزمان شروع شود و نتیجه‌ی یکی نادیده گرفته شود.
- **نحوه رفع:** استفاده از AbortController + pending promises Map (الگوی مشابه P2-5 اصلاح شده در resource):

```typescript
const _pendingLoads = new Map<string, Promise<ComponentDefinition>>();

export function loadComponent(name: string): Promise<ComponentDefinition> {
  if (_pendingLoads.has(name)) return _pendingLoads.get(name)!;

  const promise = loadFromSource(name).finally(() => {
    _pendingLoads.delete(name);
  });
  _pendingLoads.set(name, promise);
  return promise;
}
```

### BUG-COM-03: slot content در صورت نبود slot در کامپوننت بی‌صدا حذف می‌شود
- **شدت:** کم
- **محل:** `src/processor.ts`
- **شرح:** اگر کاربر محتوایی داخل یک کامپوننت قرار دهد که `<slot>` تعریف نکرده، محتوا بی‌صدا حذف می‌شود. بهتر است هشدار (warning) داده شود.
- **نحوه رفع:**

```typescript
// پس از پردازش slotها
if (hasSlotContent && !hasSlotDefined) {
  console.warn(
    `[Zenith] Component "${componentName}" has slot content but no <slot> element. ` +
    `Content will not be rendered.`,
  );
}
```

### BUG-COM-04: عدم بررسی circular dependency در کامپوننت‌های تو در تو
- **شدت:** کم
- **محل:** `src/processor.ts`
- **شرح:** اگر کامپوننت A از کامپوننت B استفاده کند و B از A، پردازش وارد loop بی‌نهایت می‌شود.
- **نحوه رفع:** افزودن `Set<string>` برای tracking کامپوننت‌های در حال پردازش:

```typescript
const _processingStack = new Set<string>();

function processComponent(name: string): void {
  if (_processingStack.has(name)) {
    throw new Error(`[Zenith] Circular component dependency detected: ${name}`);
  }
  _processingStack.add(name);
  try {
    // پردازش کامپوننت
  } finally {
    _processingStack.delete(name);
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-COM-01: افزودن `defineComponent` با تایپ‌های قوی
- **دلیل:** API functional با تایپ‌های TypeScript بهتر از تعریف JSON ساده.
- **پیاده‌سازی:**

```typescript
export function defineComponent<TProps extends Record<string, any> = {}>(
  name: string,
  definition: ComponentDefinition<TProps>,
): void {
  registerComponent(name, definition);
}
```

### IMP-COM-02: افزودن life cycle hooks به کامپوننت‌ها
- **دلیل:** فراهمسازی `onMount`، `onDestroy`، `onUpdate` برای توسعه‌دهندگان.
- **پیاده‌سازی:**

```typescript
interface ComponentLifecycle {
  onMount?: () => void | (() => void);
  onDestroy?: () => void;
  onUpdate?: (props: Record<string, any>) => void;
}

// در processor.ts پس از mount
const cleanup = component.onMount?.();
if (typeof cleanup === 'function') {
  trackComponentLifecycle(element, name, cleanup);
}
```

### IMP-COM-03: lazy loading با priority queue
- **دلیل:** کامپوننت‌های visible priority بالاتری در بارگذاری داشته باشند.
- **پیاده‌سازی:** استفاده از `IntersectionObserver`:

```typescript
export function preloadVisibleComponents(): void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const componentName = entry.element.getAttribute('zen-component');
        if (componentName) loadComponent(componentName);
        observer.unobserve(entry.element);
      }
    }
  });
  document.querySelectorAll('[zen-component]').forEach((el) => observer.observe(el));
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime/walker** | `walkAndBind` در مرحله‌ی ۶ کامپوننت‌ها را پردازش می‌کند. | ✅ درست |
| **runtime/directives** | کامپوننت‌ها می‌توانند حاوی دایرکتیوهای zen-if/zen-for باشند. | ✅ درست |
| **events** | Delegation روی Shadow DOM روت کامپوننت‌ها. | ⚠️ نیاز به تست |
| **suspense** | کامپوننت‌های async با `zen-suspense` تعامل دارند. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

سیستم کامپوننت Zenith نسبتاً ساده اما کاربردی است. Light DOM approach انتخاب معماری جالبی است که از محدودیت‌های Shadow DOM (مانند CSS encapsulation issues) اجتناب می‌کند. با این حال، نبود lifecycle hooks استاندارد و مدیریت ضعیف نشت حافظه از نقاط ضعف اصلی هستند.

**امتیاز کلی: ۶.۵/۱۰** (need lifecycle hooks, better async management)
