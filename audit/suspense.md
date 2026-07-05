# گزارش حسابرسی پکیج `suspense`
**نسخه:** v1.3.0 | **بسته:** `@zenith/suspense`

---

## ۱. خلاصه پکیج

پکیج `suspense` یک پیاده‌سازی Suspense-like برای بارگذاری async در فریم‌ورک Zenith است. از timeout/error/fallback، propagation به zen-suspenseهای تو در تو، `reset()` برای retry (v1.2.7)، و re-arm timeout (v1.2.7) پشتیبانی می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/suspense.ts` | ~۱۵۰+ | مدیریت state بارگذاری با fallback/error |

---

## ۳. باگ‌ها و مشکلات

### BUG-SUS-01: Nested Suspense propagation ممکن است باعث race condition شود
- **شدت:** بالا
- **محل:** `src/suspense.ts`
- **شرح:** اگر یک zen-suspense داخل zen-suspense دیگر باشد، حالت‌های بارگذاری/خطا ممکن است با هم تداخل داشته باشند. مثلاً suspense والد خطا نشان دهد در حالی که فرزند هنوز بارگذاری می‌کند.
- **نحوه رفع:** استفاده از state stack برای هر سطح:

```typescript
interface SuspenseState {
  status: 'pending' | 'resolved' | 'rejected';
  error?: ZenithError;
  children: SuspenseState[];
}

class SuspenseManager {
  private _states = new Map<HTMLElement, SuspenseState>();

  private _propagateUp(element: HTMLElement, state: SuspenseState): void {
    const parent = this._findParentSuspense(element);
    if (!parent) return;

    const parentState = this._states.get(parent)!;
    // فقط اگر فرزند resolved شد propagate کن
    if (state.status === 'resolved') {
      this._checkAllChildrenResolved(parent);
    } else if (state.status === 'rejected') {
      this._showFallback(parent, state.error!);
    }
  }
}
```

### BUG-SUS-02: `reset()` (v1.2.7) if reset قبل از اتمام timeout قبلی صدا زده شود
- **شدت:** متوسط
- **محل:** `src/suspense.ts`
- **شرح:** اگر `reset()` در حالی صدا زده شود که یک timeout قبلی هنوز فعال است، ممکن است دو timeout هم‌زمان داشته باشیم. این می‌تواند باعث نمایش نادرست fallback شود.
- **نحوه رفع:** پاکسازی timeout قبلی قبل از تنظیم timeout جدید:

```typescript
export function resetSuspense(element: HTMLElement): void {
  const state = _suspenseStates.get(element);
  if (!state) return;

  // پاکسازی timeout قبلی
  if (state._timeout) {
    clearTimeout(state._timeout);
    state._timeout = null;
  }

  // بازنشانی state
  state.status = 'pending';
  state.error = undefined;
  state._timeout = setTimeout(() => {
    if (state.status === 'pending') {
      _showFallback(element, state);
    }
    state._timeout = null;
  }, state.config.timeout ?? 3000);
}
```

### BUG-SUS-03: Timeout fallback بدون cleanup نمایش مداوم
- **شدت:** کم
- **محل:** `src/suspense.ts`
- **شرح:** اگر fallback بعد از timeout نمایش داده شود و سپس عملیات async کامل شود، fallback حذف می‌شود. اما اگر خود عملیات async خطا بدهد، fallback با error جایگزین می‌شود اما cleanup انجام نمی‌شود.
- **نحوه رفع:** استفاده از統一 cleanup:

```typescript
function showContent(element: HTMLElement, content: HTMLElement): void {
  const current = element.firstElementChild;
  if (current) {
    // پاکسازی کامل
    const parent = current.parentNode;
    if (parent) parent.removeChild(current);
  }
  element.appendChild(content);
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-SUS-01: افزودن loading progress bar
- **دلیل:** تجربه کاربری بهتر برای بارگذاری‌های طولانی.
- **پیاده‌سازی:** `onProgress` callback که درصد بارگذاری را اعلام کند.

### IMP-SUS-02: ترکیب با resource برای auto-retry
- **دلیل:** اگر resource با خطا مواجه شود، suspense به‌طور خودکار retry کند.
- **پیاده‌سازی:** ادغام `Resource.onError` با `Suspense.reset`.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime/walker** | `zen-suspense` در مرحله‌ی ۹ Walker پردازش می‌شود. | ✅ درست |
| **error-boundary** | ترکیب suspense + error boundary. | ✅ درست |
| **components** | لودینگ async کامپوننت با Suspense. | ✅ درست |
| **router** | Lazy route loading با Suspense. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `suspense` یک پیاده‌سازی ساده اما کارآمد از الگوی Suspense برای بارگذاری async است. مشکلات آن عمدتاً در مدیریت nested suspense و race condition در `reset()` است.

**امتیاز کلی: ۶.۵/۱۰** (کارآمد اما نیاز به بهبود nested state management)
