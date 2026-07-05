# گزارش حسابرسی پکیج `error-boundary`
**نسخه:** v1.3.0 | **بسته:** `@zenith/error-boundary`

---

## ۱. خلاصه پکیج

پکیج `error-boundary` یک سیستم مدیریت خطا برای کامپوننت‌های فریم‌ورک Zenith فراهم می‌کند. این پکیج یک `errorSignal` (از type `Signal<ZenithError | null>`) و توابعی برای subscribe, unsubscribe, reportError, clearError را ارائه می‌دهد. دایرکتیو `processErrorBoundary` در walker پردازش می‌شود.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/boundary.ts` | ~۱۰۰+ | `errorSignal`, `onError`, `reportError`, `clearError` |

---

## ۳. باگ‌ها و مشکلات

### BUG-EB-01: `reportError` ممکن است ZenithError نباشد
- **شدت:** متوسط
- **محل:** `src/boundary.ts`
- **شرح:** تابع `reportError` هر نوع خطایی را می‌پذیرد (`any`) اما `errorSignal` از نوع `Signal<ZenithError | null>` است. اگر خطای غیر ZenithError report شود، signal مقدار اشتباه می‌گیرد.
- **نحوه رفع:** تبدیل خودکار به ZenithError:

```typescript
export function reportError(error: unknown): void {
  if (error instanceof ZenithError) {
    errorSignal.set(error);
  } else if (error instanceof Error) {
    errorSignal.set(new ZenithError('RuntimeError', error.message, {
      details: { originalName: error.name, stack: error.stack },
    }));
  } else {
    errorSignal.set(new ZenithError('RuntimeError', String(error), {
      details: { originalType: typeof error },
    }));
  }
}
```

### BUG-EB-02: `onError` (subscribe) cleanup در حذف کامپوننت فراموش می‌شود
- **شدت:** بالا
- **محل:** `src/boundary.ts`
- **شرح:** `onError` یک callback subscribe می‌کند و تابع unsubscribe برمی‌گرداند. اما بسیاری از فراخوان‌ها تابع cleanup را ذخیره و صدا نمی‌زنند و باعث نشت شنونده می‌شوند.
- **نحوه رفع:** استفاده از `FinalizationRegistry` یا auto-cleanup با element:

```typescript
export function onError(
  callback: (error: ZenithError) => void,
  element?: HTMLElement,
): () => void {
  _listeners.add(callback);

  // Auto-cleanup اگر element حذف شود
  if (element) {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) {
        _listeners.delete(callback);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    _listeners.delete(callback);
  };
}
```

### BUG-EB-03: `clearErrorBoundary` ممکن است با race condition خطاهای جدید را پاک کند
- **شدت:** کم
- **محل:** `src/boundary.ts`
- **شرح:** اگر `clearErrorBoundary` بلافاصله بعد از یک `reportError` صدا زده شود، ممکن است خطای جدیدی که boundary دیگری report کرده را پاک کند (زمانی که از یک signal مشترک استفاده می‌کنند).
- **نحوه رفع:** استفاده از error generation counter:

```typescript
const _errorGen = { current: 0 };

export function reportError(error: ZenithError): void {
  _errorGen.current++;
  const gen = _errorGen.current;
  errorSignal.set(error);

  // هر listener که این خطا را پردازش کرد باید gen را بررسی کند
}

export function clearErrorBoundary(): void {
  // فقط اگر خطای جدیدی در راه نیست پاک کن
  const gen = _errorGen.current;
  setTimeout(() => {
    if (gen === _errorGen.current) {
      errorSignal.set(null);
    }
  }, 0);
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-EB-01: Error boundary nesting (boundary داخل boundary)
- **دلیل:** مدیریت خطا در سطوح مختلف.
- **پیاده‌سازی:** زنجیره‌سازی boundaries با propagation:

```typescript
export function processErrorBoundary(element: HTMLElement): void {
  const fallback = element.getAttribute('zen-error-fallback');
  const parentBoundary = findParentBoundary(element);

  const cleanup = onError((error) => {
    if (!parentBoundary || !parentBoundary.canHandle(error)) {
      // نمایش fallback UI
      handleErrorLocally(element, error, fallback);
    } else {
      // propagation به parent
      parentBoundary.handleError(error);
    }
  }, element);
}
```

### IMP-EB-02: Recoverable error support
- **دلیل:** امکان retry بعد از خطا.
- **پیاده‌سازی:**

```typescript
export function retryAfterError(error: ZenithError): void {
  clearErrorBoundary();
  // تلاش مجدد عملیات شکست‌خورده
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **errors** | `ZenithError` نوع اصلی خطاها در error boundary. | ✅ درست |
| **runtime/walker** | `processErrorBoundary` در مرحله‌ی ۸ Walker پردازش می‌شود. | ✅ درست |
| **suspense** | ترکیب suspense + error boundary برای lazy loading. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `error-boundary` هرچند کوچک است اما عملکرد اساسی خود را انجام می‌دهد. با این حال، عدم تبدیل خودکار خطاهای غیر ZenithError و نبود auto-cleanup برای listenerها از نقاط ضعف آن است.

**امتیاز کلی: ۶/۱۰** (اصلی اما نیاز به تکامل)
