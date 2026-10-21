// packages/components/src/processor.ts
//
// پردازشگر کامپوننت‌ها — قلب فاز ۶.
//
// این فایل یک تگ سفارشی (مثل <app-product-card>) را به این شکل پردازش می‌کند:
//   1) قالب را از Registry می‌گیرد و clone می‌کند.
//   2) Props را از attribute های تگ جمع‌آوری می‌کند.
//   3) Slotها را با محتوای داخل تگ پر می‌کند.
//   4) Context محلی کامپوننت را می‌سازد (ارث‌بری از parent + Props).
//   5) محتوای کامپوننت را با Context محلی walk می‌کند.
//
// ── Props ──
// دو نوع attribute روی تگ کامپوننت داریم:
//   1) prop:<name>="<expr>"  → یک Expression که در parentContext ارزیابی می‌شود.
//                              نتیجه به‌صورت `$<name>` در Context محلی قرار می‌گیرد.
//   2) <name>="literal"      → یک رشته‌ی ثابت. به‌صورت `$<name>` در Context محلی قرار می‌گیرد.
//
// مثال:
//   <app-product-card prop:id="product.id" prop:name="product.name" theme="dark">
//   → در Context محلی کامپوننت:
//       $id   = parentContext.$product.id   (از ارزیابی expression)
//       $name = parentContext.$product.name (از ارزیابی expression)
//       $theme = "dark"                     (literal string)
//
// ── Slots ──
//   - <slot></slot>               → slot پیش‌فرض (محتوای بدون `slot` attribute).
//   - <slot name="actions"></slot> → slot نام‌گذاری شده.
//   - محتوای داخل تگ کامپوننت با `slot="actions"` به این slot می‌رود.
//
// ── Context ارث‌بری ──
//   Context محلی با `Object.create(parentContext)` ساخته می‌شود تا:
//     - تمام getter های والد (مثل `$user`, `$product` از zen-for) در دسترس باشند.
//     - Props جدید به‌صورت `$name` روی Context محلی override شوند.
//     - هیچ کپی سطحی انجام نشود (getter های reactive حفظ می‌شوند).


import { getComponent, trackComponentLifecycle } from './registry';
import { developerError, ErrorCode, reportError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { buildComponentContext } from './processor-props';
import { buildSlotContents, fillSlots } from './processor-slots';
import { lifecycleHooks } from './processor-lifecycle';

// ─────────────────────────────────────────────────────────────────────────
// BUG-COM-04 (v1.3.0): Circular Dependency Detection
// ─────────────────────────────────────────────────────────────────────────
//
// کامپوننت‌ها می‌توانند حاوی کامپوننت‌های دیگر باشند (کامپوننت‌های تو در تو).
// اگر دو کامپوننت به صورت متقابل (circular) به یکدیگر ارجاع دهند، پردازش
// وارد یک حلقه‌ی بی‌نهایت می‌شود و stack overflow رخ می‌دهد.
//
// The _processingStack tracks which components are currently being processed
// in the call chain. Before processing any component, we check if it's already
// in the stack. If so, we throw a descriptive error immediately instead of
// recursing infinitely.
const _processingStack = new Set<string>();

/**
 * پردازش یک تگ کامپوننت سفارشی.
 *
 * این تابع نقطه‌ی ورود اصلی سیستم کامپوننت‌هاست. توسط walker فراخوانی
 * می‌شود وقتی به تگی می‌رسد که در Registry ثبت شده است.
 *
 * مراحل:
 *   1) قالب را از Registry می‌گیرد. اگر نبود، return (نادیده گرفته می‌شود).
 *   2) Context محلی را با ارث‌بری از parentContext و افزودن Props می‌سازد.
 *   3) محتوای slot را از داخل تگ جمع‌آوری می‌کند.
 *   4) قالب را clone کرده و slotها را پر می‌کند.
 *   5) محتوای تگ کامپوننت را با محتوای قالب جایگزین می‌کند.
 *   6) فرزندان کامپوننت را با Context محلی walk می‌کند (به‌جز slot content
 *      که با Context والد walk می‌شود).
 *
 * @param el              تگ کامپوننت.
 * @param parentContext   Context والد.
 * @param processChildren callback برای walk فرزندان.
 *                        امضا: (node, context, disposes, isSlotContent) => void
 *                        - isSlotContent=true: محتوا با parentContext walk می‌شود.
 *                        - isSlotContent=false: محتوا با localContext walk می‌شود.
 * @param disposes        آرایه‌ی dispose functions (برای Memory Leak Prevention).
 *                        #116: همچنان پر می‌شود (سازگاری) و Cleanup برگردانده
 *                        می‌شود.
 * @returns Cleanup تابعی idempotent که disposeهای ثبت‌شدهٔ همین کامپوننت را
 *           اجرا می‌کند (#116: همهٔ `process*` → `Cleanup`).
 */
export function processComponent(
  el: HTMLElement,
  parentContext: Record<string, unknown>,
  processChildren: (
    node: HTMLElement,
    context: Record<string, unknown>,
    disposes: (() => void)[],
    isSlotContent: boolean,
  ) => void,
  disposes: (() => void)[],
): () => void {
  const tagName = el.tagName.toLowerCase();
  const template = getComponent(tagName);
  if (!template) {
    // اگر کامپوننت ثبت نشده بود، چیزی برای پردازش نیست.
    // walker هم که این تابع را فراخوانی کرده، return می‌کند.
    return () => {}; // #116: Cleanup no-op برای کامپوننت ثبت‌نشده
  }

  // BUG-COM-04 (v1.3.0): Circular dependency detection.
  // If this component is already in the processing stack, two components
  // reference each other (A → B → A). Throw a clear error immediately
  // instead of recursing into a stack overflow.
  if (_processingStack.has(tagName)) {
    throw developerError(
      `Circular component dependency detected: "${tagName}" ` +
        `is already being processed. Check your component nesting — ` +
        `component "${tagName}" should not reference itself ` +
        `(directly or indirectly).`,
      ErrorCode.RUNTIME_COMPONENT_NOT_FOUND,
    );
  }
  _processingStack.add(tagName);

  // #116 cleanup protocol: disposeهای فرزندان و onMount این کامپوننت در
  // آرایهٔ محلی جمع می‌شوند؛ سپس یک Cleanup idempotent هم به disposes والد
  // اضافه می‌شود (سازگاری) و هم به فراخوان برگردانده می‌شود.
  const componentDisposes: (() => void)[] = [];

  try {
    // ── ۱. ساخت Context محلی (ارث‌بری از والد + Props) ──
    const localContext = buildComponentContext(el, parentContext);

    // ── ۲. جمع‌آوری محتوای slot از داخل تگ کامپوننت ──
    // این کار را قبل از clone و clear کردن innerHTML انجام می‌دهیم چون بعد از
    // آن، فرزندان از بین می‌روند.
    const slotContents = buildSlotContents(el);

    // برای هر فرزند slot، یک flag ذخیره می‌کنیم تا بعداً بتوانیم تشخیص دهیم
    // با کدام Context باید walk شوند (parent برای slot content، local برای
    // محتوای خود قالب).
    const slotNodes = new Set<HTMLElement>();
    for (const nodes of slotContents.values()) {
      for (const node of nodes) slotNodes.add(node);
    }

    // ── ۳. کلون کردن محتوای قالب ──
    const content = template.content.cloneNode(true) as DocumentFragment;

    // ── ۴. پر کردن slotها ──
    fillSlots(content, slotContents);

    // BUG-COM-03 (v1.3.0): Warn when slot content exists but component
    // template has no <slot> element. Previously this was a silent no-op
    // — the slot content children were simply cleared when we set
    // el.innerHTML = '' above, and no warning was produced, making this
    // a confusing developer experience.
    {
      const hasSlotContent = Array.from(slotContents.values()).some((arr) => arr.length > 0);
      const templateSlots = content.querySelectorAll('slot');
      if (hasSlotContent && templateSlots.length === 0) {
        logger.warn(
          `[Zenith] Component "${tagName}" has slot content but no <slot> ` +
            `element in its template. The slot content will not be rendered.`,
        );
      }
    }

    // ── ۵. جایگزینی محتوای تگ کامپوننت با محتوای قالب ──
    // ابتدا innerHTML را خالی می‌کنیم (اگر محتوای slot نبود، حذف می‌شود).
    // سپس محتوای قالب را درج می‌کنیم.
    el.innerHTML = '';
    el.appendChild(content);

    // ── ۶. Walk فرزندان با Context مناسب ──
    // دو نوع فرزند داریم:
    //   a) فرزندان قالب کامپوننت → با localContext (شامل Props) walk می‌شوند.
    //   b) فرزندان slot content → با parentContext (Context محل استفاده) walk می‌شوند.
    //
    // این تفکیک مهم است چون اگر slot content با localContext walk شود،
    // به Props دسترسی دارد که منطقی نیست (Props فقط برای قالب کامپوننت هستند).
    // slot content باید در محیطی که کامپوننت استفاده شده، ارزیابی شود.
    for (const child of Array.from(el.children)) {
      const childEl = child as HTMLElement;
      const isSlot = slotNodes.has(childEl);
      processChildren(childEl, isSlot ? parentContext : localContext, componentDisposes, isSlot);
    }

    // IMP-COM-02 (v1.3.0): Lifecycle hooks — call onMount after the
    // component template has been initialized and its children walked.
    // If onMount returns a cleanup function, register it as a dispose
    // handler so it runs when the component element is removed from the
    // DOM (via the MutationObserver in registry.ts).
    const hooks = lifecycleHooks.get(tagName);
    if (hooks?.onMount) {
      try {
        const cleanup = hooks.onMount();
        if (typeof cleanup === 'function') {
          componentDisposes.push(cleanup);
          // Also register with the MutationObserver-based lifecycle tracker
          // so cleanup fires when the element leaves the DOM even if the
          // walker doesn't explicitly call the dispose array.
          if (typeof trackComponentLifecycle === 'function') {
            try {
              trackComponentLifecycle(el, cleanup);
            } catch {
              /* ignore — non-critical */
            }
          }
        }
      } catch (err) {
        logger.error(
          `[Zenith] Lifecycle onMount error for "${tagName}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // ── ۷. Cleanup (#116) ──
    // یک Cleanup idempotent ساخته می‌شود که disposeهای همین کامپوننت را
    // اجرا کند؛ هم به disposes والد اضافه می‌شود (سازگاری با walker/HMR)
    // و هم به فراخوان برگردانده می‌شود.
    let cleaned = false;
    const idempotentCleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      for (const d of componentDisposes) {
        try {
          d();
        } catch (err) {
          // #116/DEC-031: لاگ از hub؛ نه چاپ مستقیم در کنسول.
          reportError(err, `component:${tagName}`, { phase: 'dispose' });
        }
      }
      componentDisposes.length = 0;
    };
    disposes.push(idempotentCleanup);
    return idempotentCleanup;
  } finally {
    // BUG-COM-04 (v1.3.0): Always remove this component from the
    // processing stack, even if an error was thrown during processing.
    // This ensures the next call for the same component (from a
    // different location in the DOM) works correctly.
    _processingStack.delete(tagName);
  }
}
// #40: سازگاری deep-import تست (`../src/processor`) — این نام‌ها از ماژول
// lifecycle دوباره export می‌شوند؛ سطح عمومی عین قبل است.
export { getLifecycle, registerLifecycle, type ComponentLifecycle } from './processor-lifecycle';
