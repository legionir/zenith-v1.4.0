// packages/notifications/src/focus-trap.ts
//
// #132 — focus trap سبک برای دیالوگ‌های Alert/Confirm.
//
// چرا اینجا و نه `@zenith/a11y`؟ پکیج `@zenith/a11y` در این نسخه فقط در
// فهرست لایه‌ها برنامه‌ریزی شده است (scripts/architecture-layers.json) و روی
// دیسک وجود ندارد؛ `@zenith/runtime-core` هم که `createFocusTrap` دارد در
// لایهٔ L3 است و ورود از L2 (`@zenith/notifications`) یک وابستگی رو به بالا و
// ممنوع است (.dependency-cruiser.cjs). بنابراین همین قرارداد کوچک تا زمان
// ساخته‌شدن `@zenith/a11y` اینجا نگه داشته می‌شود و با همان امضا
// (`createDialogFocusTrap(container, options) -> DialogFocusTrap`) در پکیج مشترک
// منتقل خواهد شد (ADR 0015 / DEC-022).
//
// نام‌ها عمداً `Dialog*` دارند: `createFocusTrap`/`FocusTrap` هم‌اکنون در
// `@zenith/runtime-core` وجود دارد و گیت #119 نام تکراری با معنای مستقل را
// رد می‌کند.

/** API دیالوگ تله‌شده. */
export interface DialogFocusTrap {
  /** شروع گرفتن Tab/Shift+Tab داخل container و فوکوس اولیه. */
  activate(): void;
  /** توقف گرفتن کلیدها و برگرداندن فوکوس به عنصر قبلی. */
  deactivate(): void;
  /** برابر `deactivate()` ولی idempotent برای teardown. */
  dispose(): void;
  /** آیا فعال است؟ */
  isActive(): boolean;
}

export interface DialogFocusTrapOptions {
  /** سند هدف (پیش‌فرض: `container.ownerDocument`). */
  doc?: Document;
  /** عنصر فوکوس اولیه (پیش‌فرض: نخستین عنصر قابل‌فوکوس داخل container). */
  initialFocus?: HTMLElement | null;
  /** بازگرداندن فوکوس به عنصر قبلی هنگام `deactivate` (پیش‌فرض: true). */
  returnFocus?: boolean;
  /** کلید بستن (پیش‌فرض: `Escape` با فراخوانی `onEscape`). */
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex !== -1,
  );
}

/**
 * تلهٔ فوکوس: Tab و Shift+Tab بین عناصر قابل‌فوکوس `container` می‌چرخند و
 * فوکوس با `deactivate()` به عنصر قبلی برمی‌گردد. اگر `container` هیچ عنصر
 * قابل‌فوکوسی نداشته باشد، خودِ container (`tabindex="-1"`) فوکوس می‌شود.
 */
export function createDialogFocusTrap(
  container: HTMLElement,
  options: DialogFocusTrapOptions = {},
): DialogFocusTrap {
  const doc = options.doc ?? container.ownerDocument;
  const returnFocus = options.returnFocus ?? true;
  let previous: HTMLElement | null = null;
  let active = false;

  const onKeydown = (event: KeyboardEvent) => {
    if (!active) return;
    if (event.key === 'Escape') {
      options.onEscape?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const items = focusableIn(container);
    if (items.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const current = doc.activeElement as HTMLElement | null;
    const inside = current ? container.contains(current) : false;

    if (!inside) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    activate() {
      if (active) return;
      active = true;
      previous = (doc.activeElement as HTMLElement | null) ?? null;
      container.addEventListener('keydown', onKeydown);
      const target = options.initialFocus ?? focusableIn(container)[0] ?? container;
      if (target === container && !container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      target.focus?.();
    },
    deactivate() {
      if (!active) return;
      active = false;
      container.removeEventListener('keydown', onKeydown);
      if (returnFocus && previous && typeof previous.focus === 'function') {
        previous.focus();
      }
      previous = null;
    },
    dispose() {
      this.deactivate();
    },
    isActive() {
      return active;
    },
  };
}
