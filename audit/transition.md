# گزارش حسابرسی پکیج `transition`
**نسخه:** v1.3.0 | **بسته:** `@zenith/transition`

---

## ۱. خلاصه پکیج

پکیج `transition` سیستم ترنزیشن و انیمیشن فریم‌ورک Zenith را پیاده‌سازی می‌کند. از الگوی double-rAF + force reflow + `transitionend` + setTimeout fallback برای تشخیص پایان انیمیشن استفاده می‌کند. توابع اصلی `enterTransition` و `leaveTransition` با پشتیبانی از `cancel` برای قطع و وصل سریع (rapid toggle) هستند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/transition.ts` | ~۲۰۰+ | `enterTransition` و `leaveTransition` با مدیریت زمان‌بندی |
| `src/index.ts` | ~۱۰ | re-export |

لازم به ذکر است که فایل `animate.ts` در این پکیج وجود ندارد و منطق انیمیشن در `transition.ts` متمرکز شده است.

---

## ۳. باگ‌ها و مشکلات

### BUG-TRN-01: `transitionend` listener پس از timeout پاک نمی‌شود
- **شدت:** بالا
- **محل:** `src/transition.ts` – هر دو تابع `enterTransition` و `leaveTransition`
- **شرح:** اگر انیمیشن قبل از `transitionend` کامل شود (timeout)، listener رویداد `transitionend` همچنان روی element باقی می‌ماند. این باعث می‌شود ترنزیشن بعدی روی همان element بلافاصله با listener قدیمی trigger شود.
- **نحوه رفع:** پاکسازی listener در همه‌ی مسیرهای خروج:

```typescript
export function enterTransition(
  element: HTMLElement,
  options?: TransitionOptions,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onEnd = () => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      element.removeEventListener('transitionend', onEnd);
      element.removeEventListener('webkitTransitionEnd', onEnd);
      resolve();
    };

    element.addEventListener('transitionend', onEnd);
    element.addEventListener('webkitTransitionEnd', onEnd);

    // رفع: ذخیره timeout برای cleanup
    timer = setTimeout(onEnd, options?.duration ?? 300);

    // cancel function
    options?.cancel?.(() => {
      onEnd();
    });
  });
}
```

### BUG-TRN-02: double-rAF + force reflow باعث jank در دستگاه‌های ضعیف می‌شود
- **شدت:** متوسط
- **محل:** `src/transition.ts`
- **شرح:** الگوی double-rAF با `element.offsetHeight` خواندن (force reflow) یک anti-pattern شناخته‌شده است. در دستگاه‌های با刷新‌پایین یا CPU ضعیف، این کار باعث jank و افت فریم می‌شود.
- **نحوه رفع:** جایگزینی با `requestAnimationFrame` + `FLIP` تکنیک مدرن‌تر:

```typescript
export function enterTransition(element: HTMLElement): Promise<void> {
  // استفاده از getComputedStyle به جای offsetHeight
  const styles = getComputedStyle(element);
  // استفاده از Web Animations API در صورت پشتیبانی
  if (element.animate) {
    const animation = element.animate([
      { opacity: '0', transform: 'translateY(-10px)' },
      { opacity: '1', transform: 'translateY(0)' },
    ], { duration: 300, easing: 'ease-out' });
    return animation.finished;
  }
  // fallback به روش قدیمی
  return legacyEnterTransition(element);
}
```

### BUG-TRN-03: `cancel` function برای rapid toggle (BUG-01/05) ممکن است دو بار صدا زده شود
- **شدت:** متوسط
- **محل:** `src/transition.ts` – BUG-01/05 fix
- **شرح:** اگر کاربر خیلی سریع toggle کند، ممکن است `cancel` تابع قبلی و جدید هر دو اجرا شوند و باعث double resolve promise شود.
- **نحوه رفع:** استفاده از flag برای اطمینان از یکبار اجرا:

```typescript
export function createCancellableTransition(element: HTMLElement): {
  enter: () => Promise<void>;
  leave: () => Promise<void>;
  cancel: () => void;
} {
  let _current: Promise<void> | null = null;
  let _cancelled = false;

  const cancel = () => {
    _cancelled = true;
    // پاکسازی کامل
  };

  const enter = async () => {
    _cancelled = false;
    const promise = enterTransition(element, { cancel });
    _current = promise;
    await promise;
    if (_current === promise) _current = null;
  };

  return { enter, leave, cancel };
}
```

### BUG-TRN-04: عدم مدیریت `display: none` در هنگام ترنزیشن
- **شدت:** کم
- **محل:** `src/transition.ts`
- **شرح:** اگر عنصر در حین ترنزیشن `display: none` شود (مثلاً توسط CSS class)، `transitionend` هرگز fire نمی‌شود و تا timeout صبر می‌کند.
- **نحوه رفع:** استفاده از `transitionrun` برای تشخیص:

```typescript
element.addEventListener('transitionrun', () => {
  // ترنزیشن شروع شده
});
element.addEventListener('transitioncancel', () => {
  // ترنزیشن لغو شده (display: none, etc)
  onEnd();
});
```

---

## ۴. پیشنهادات ارتقا

### IMP-TRN-01: پشتیبانی از Web Animations API
- **دلیل:** عملکرد بهتر، پشتیبانی از cancelation واقعی، API تمیزتر.
- **پیاده‌سازی:**

```typescript
export function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options?: KeyframeAnimationOptions,
): Promise<void> {
  if (!element.animate) {
    return legacyTransition(element, options);
  }
  const animation = element.animate(keyframes, options);
  return animation.finished.catch(() => { /* ignore abort */ });
}
```

### IMP-TRN-02: افزودن easing functions سفارشی
- **دلیل:** انعطاف‌پذیری بیشتر در انیمیشن‌ها.
- **پیاده‌سازی:** پشتیبانی از `cubic-bezier` سفارشی:

```typescript
export function parseEasing(easing: string): EffectTiming['easing'] {
  const builtin = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];
  if (builtin.includes(easing)) return easing;
  // اعتبارسنجی cubic-bezier
  if (/^cubic-bezier\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+\)$/.test(easing)) {
    return easing;
  }
  return 'ease';
}
```

### IMP-TRN-03: افزودن group transition (multiple elements)
- **دلیل:** transitions برای لیست‌ها و containerهای چند عنصری.
- **پیاده‌سازی:**

```typescript
export function animateGroup(
  elements: HTMLElement[],
  options?: TransitionOptions,
): Promise<void[]> {
  return Promise.all(
    elements.map((el, i) =>
      enterTransition(el, { ...options, delay: (options?.staggerDelay ?? 50) * i }),
    ),
  );
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime/directives/if** | `processIf` از `enterTransition`/`leaveTransition` استفاده می‌کند (BUG-01/05). | ✅ درست |
| **runtime/walker** | `zen-show` و `zen-animate` برای نمایش/مخفی با ترنزیشن. | ✅ درست |
| **router** | ترنزیشن بین مسیرها (در صورت پشتیبانی). | ⚠️ گسستگی |
| **suspense** | ترنزیشن هنگام نمایش fallback suspense. | ⚠️ گسستگی |

---

## ۶. نتیجه‌گیری کلی

پکیج `transition` با وجود پیاده‌سازی نسبتاً خوب، از anti-pattern قدیمی double-rAF + force reflow استفاده می‌کند. با توجه به اینکه Web Animations API امروزه در همه مرورگرهای مدرن پشتیبان می‌شود (از جمله IE با polyfill)، توصیه می‌شود مهاجرت به WAAPI انجام شود.

**امتیاز کلی: ۶/۱۰** (عملکردی اما قدیمی، نیاز به WAAPI)
