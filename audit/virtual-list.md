# گزارش حسابرسی پکیج `virtual-list`
**نسخه:** v1.3.0 | **بسته:** `@zenith/virtual-list`

---

## ۱. خلاصه پکیج

پکیج `virtual-list` یک پیاده‌سازی virtual scrolling برای فریم‌ورک Zenith است. از `IntersectionObserver` برای تشخیص محدوده دید استفاده می‌کند و قابلیت تنظیم `itemHeight` و `buffer` را دارد. از ارتفاع‌های پویا از طریق `ResizeObserver` + prefix sum و جستجوی باینری برای تبدیل offset به آیتم پشتیبانی می‌کند. همچنین دارای placeholders برای حالت‌های empty و loading است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/virtual-list.ts` | ~۲۰۰+ | پیاده‌سازی virtual scrolling |

---

## ۳. باگ‌ها و مشکلات

### BUG-VL-01: `IntersectionObserver` در SSR در دسترس نیست
- **شدت:** بالا
- **محل:** `src/virtual-list.ts`
- **شرح:** `IntersectionObserver` یک API مرورگر است و در محیط SSR (Node.js) وجود ندارد. اگر کامپوننت در سمت سرور رندر شود، با خطا مواجه می‌شود.
- **نحوه رفع:** بررسی وجود API قبل از استفاده:

```typescript
export function processVirtualList(element: HTMLElement): void {
  if (typeof IntersectionObserver === 'undefined') {
    // Fallback در SSR: نمایش همه آیتم‌ها
    renderAllItems(element);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    // ...
  });
}
```

### BUG-VL-02: Dynamic heights با `ResizeObserver` ممکن است باعث layout thrashing شود
- **شدت:** متوسط
- **محل:** `src/virtual-list.ts`
- **شرح:** `ResizeObserver` در هر تغییر اندازه callback را اجرا می‌کند. اگر prefix sum array در هر callback بازسازی شود، این کار در لیست‌های بزرگ باعث performance hit قابل توجهی می‌شود.
- **نحوه رفع:** Debounce کردن بازسازی prefix sum:

```typescript
class VirtualList {
  private _rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

  private _scheduleRebuild(): void {
    if (this._rebuildTimeout) return;
    this._rebuildTimeout = setTimeout(() => {
      this._rebuildPrefixSum();
      this._rebuildTimeout = null;
    }, 16); // ~1 frame
  }

  private _rebuildPrefixSum(): void {
    // بازسازی prefix sum array
  }
}
```

### BUG-VL-03: `binary search` برای offset-to-item ممکن است overflow کند
- **شدت:** کم
- **محل:** `src/virtual-list.ts`
- **شرح:** جستجوی باینری روی prefix sum array اگر آرایه خالی باشد یا offset خارج از محدوده باشد، ممکن است index نامعتبر برگرداند.
- **نحوه رفع:** افزودن boundary checks:

```typescript
function findItemByOffset(prefixSum: number[], offset: number): number {
  if (prefixSum.length === 0) return 0;
  if (offset <= 0) return 0;
  if (offset >= prefixSum[prefixSum.length - 1]) return prefixSum.length - 1;

  // جستجوی باینری
  let low = 0, high = prefixSum.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (prefixSum[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}
```

### BUG-VL-04: Buffer size ثابت است و با viewport تغییر نمی‌کند
- **شدت:** کم
- **محل:** `src/virtual-list.ts`
- **شرح:** `buffer` یک مقدار ثابت (تعداد آیتم‌های اضافی در هر طرف viewport) است که با توجه به اندازه viewport تنظیم نمی‌شود. برای viewportهای بزرگ، buffer باید بزرگتر باشد.
- **نحوه رفع:** محاسبه buffer پویا:

```typescript
function calculateDynamicBuffer(viewportHeight: number, itemHeight: number): number {
  const visibleItems = Math.ceil(viewportHeight / itemHeight);
  return Math.max(5, Math.ceil(visibleItems * 0.5)); // 50% اضافه
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-VL-01: افزودن horizontal scrolling support
- **دلیل:** پشتیبانی از لیست‌های افقی.
- **پیاده‌سازی:** پارامتر `direction: 'vertical' | 'horizontal'`.

### IMP-VL-02: افزودن item animation (mount/unmount)
- **دلیل:** انیمیشن هنگام اضافه/حذف آیتم‌ها.
- **پیاده‌سازی:** استفاده از FLIP animation.

### IMP-VL-03: افزودن scrollToIndex برای اسکرول به آیتم خاص
- **دلیل:** قابلیت «رفتن به آیتم N».

```typescript
scrollToIndex(index: number): void {
  const offset = this._getOffsetForIndex(index);
  this._container.scrollTop = offset;
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime/walker** | `zen-virtual-list` در walker. | ✅ درست |
| **runtime/directives** | آیتم‌های virtual list می‌توانند دایرکتیو داشته باشند. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `virtual-list` یک پیاده‌سازی مفید با پشتیبانی از IntersectionObserver و ResizeObserver است. مشکل اصلی آن عدم وجود SSR fallback است که در یک فریم‌ورک full-stack مشکل ایجاد می‌کند.

**امتیاز کلی: ۶/۱۰** (کارآمد اما نیاز به SSR support و بهینه‌سازی dynamic heights)
