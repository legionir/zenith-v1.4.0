import { processText } from './directives/text';
import { processHtml } from './directives/html';
import { processHtmlTrusted } from './directives/html-trusted';
import { processBind } from './directives/bind';
import { processModel } from './directives/model';
import { processPersist } from './directives/persist';
import { processPortal } from './directives/portal';
import { processIntersection } from './directives/intersection';
import { processRef } from './directives/ref';
import { processCloak } from './directives/cloak';
import { processOptimistic } from './directives/optimistic';
import { processTrack } from './directives/track';
import { trackDirective } from './walker-telemetry';
/** Value-directive dispatch operands. @internal */
export interface NodeDirectiveInput { context: Record<string, unknown>; state: Record<string, unknown>; disposes: (() => void)[]; }
/** Preserve directive priority, tracking and mutable attribute iteration order. @internal */
export function processNodeDirectives(el: HTMLElement, input: NodeDirectiveInput): void {
  const { context, state, disposes } = input;
  // ── zen-html-trusted / zen-html / zen-text (فاز ۹ + v0.4.0: فقط یکی از آنها) ──
  // یک عنصر نمی‌تواند همزمان چند دایرکتیو text/html داشته باشد.
  // اولویت: zen-html-trusted > zen-html > zen-text.
  //   - zen-html-trusted: توسعه‌دهنده صراحتاً opt-in کرده که محتوا Trusted است.
  //     اگر این وجود داشت، override می‌کند چون عمدی‌ترین انتخاب است.
  //   - zen-html:         همیشه sanitize می‌شود.
  //   - zen-text:         متن ساده، امن.
  // FEATURE (v0.4.0): zen-html-trusted registered in walker dispatch.
  if (el.hasAttribute('zen-html-trusted')) {
    const expr = el.getAttribute('zen-html-trusted')!;
    disposes.push(processHtmlTrusted(el, expr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'html-trusted', expression: expr });
  } else if (el.hasAttribute('zen-html')) {
    const expr = el.getAttribute('zen-html')!;
    disposes.push(processHtml(el, expr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'html', expression: expr });
  } else if (el.hasAttribute('zen-text')) {
    const expr = el.getAttribute('zen-text')!;
    disposes.push(processText(el, expr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'text', expression: expr });
  }

  // ── zen-bind:*: اتصال به Attribute ──
  // ممکن است چندین zen-bind:* روی یک عنصر باشند.
  // Array.from برای جلوگیری از تغییر در حین iteration لازم است.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('zen-bind:')) {
      const attrName = attr.name.slice('zen-bind:'.length);
      disposes.push(processBind(el, attrName, attr.value, context));
      // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
      trackDirective(el, { directiveType: `bind:${attrName}`, expression: attr.value });
    }
  }

  // ── zen-model: Two-way binding ──
  if (el.hasAttribute('zen-model')) {
    const expr = el.getAttribute('zen-model')!;
    disposes.push(processModel(el, expr, context, state));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'model', expression: expr });
  }

  // ── zen-persist (#145): ذخیرهٔ مقدار zen-model در @zenith/storage ──
  // بعد از zen-model می‌آید تا hydrate روی همان signal بنشیند و listener ما
  // پس از model ثبت شود (منبع مقدار: خود el؛ وابستگی به ترتیب نداریم).
  if (el.hasAttribute('zen-persist')) {
    const persistKey = el.getAttribute('zen-persist')!;
    disposes.push(processPersist(el, persistKey, context, state));
    trackDirective(el, { directiveType: 'persist', expression: persistKey });
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
  // ─────────────────────────────────────────────────────────────

  // ── zen-portal: جابجایی عنصر به container دیگر ──
  // این دایرکتیو عنصر را از محل فعلی‌اش در DOM برمی‌دارد و به یک container
  // دیگر (مثلاً body یا #modal-root) منتقل می‌کند. برای modalها، tooltipها،
  // و notificationها مفید است که نباید تحت z-index/overflow والد باشند.
  // dispose: عنصر را به محل اصلی‌اش برمی‌گرداند.
  if (el.hasAttribute('zen-portal')) {
    const targetSelector = el.getAttribute('zen-portal')!;
    disposes.push(processPortal(el, targetSelector, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'portal', expression: targetSelector });
  }

  // ── zen-intersection: lazy-load با IntersectionObserver ──
  // این دایرکتیو یک IntersectionObserver می‌سازد و وقتی عنصر وارد viewport
  // شد، یک callback (که در context ارزیابی می‌شود) را فراخوانی می‌کند.
  // dispose: observer.disconnect().
  // SSR-safe: اگر IntersectionObserver تعریف نشده باشد، no-op می‌شود.
  if (el.hasAttribute('zen-intersection')) {
    const callbackExpr = el.getAttribute('zen-intersection')!;
    disposes.push(processIntersection(el, callbackExpr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'intersection', expression: callbackExpr });
  }

  // ── zen-ref: bind عنصر DOM به یک Signal ──
  // این دایرکتیو عنصر DOM را در یک Signal در state ذخیره می‌کند تا
  // بتوان از Actionها و Effectها به آن دسترسی داشت (مثلاً focus کردن).
  // dispose: signal.set(null) برای جلوگیری از memory leak.
  if (el.hasAttribute('zen-ref')) {
    const refName = el.getAttribute('zen-ref')!;
    // نکته: state پاس داده می‌شود چون Signalها در state ذخیره می‌شوند
    // (در context فقط getterهای آنها دیده می‌شود، نه خود Signal).
    disposes.push(processRef(el, refName, state));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'ref', expression: refName });
  }

  // ── zen-cloak: حذف attribute برای visible شدن عنصر (ضد FOUC) ──
  // این دایرکتیو باید **آخرین** دایرکتیوی باشد که اجرا می‌شود چون کار آن
  // این است که پس از پردازش تمام دایرکتیوهای دیگر، عنصر را visible کند.
  // اگر زودتر اجرا شود، کاربر برای یک لحظه محتوای پردازش‌نشده می‌بیند.
  // CSS: `[zen-cloak] { display: none; }`
  if (el.hasAttribute('zen-cloak')) {
    disposes.push(processCloak(el));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'cloak', expression: '' });
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE (v1.2.0): v1.2.x non-structural directives.
  // ─────────────────────────────────────────────────────────────

  // ── zen-optimistic: optimistic update with rollback ──
  // روی click، Expression مثبت را اعمال می‌کند، اکشن نام‌گذاری‌شده را
  // await می‌کند، و در صورت خطا Expression rollback را اجرا می‌کند.
  if (el.hasAttribute('zen-optimistic')) {
    const optimisticExpr = el.getAttribute('zen-optimistic')!;
    const rollbackExpr = el.getAttribute('data-rollback');
    disposes.push(processOptimistic(el, optimisticExpr, rollbackExpr, context, state));
    trackDirective(el, { directiveType: 'optimistic', expression: optimisticExpr });
  }

  // ── zen-track: analytics tracking ──
  // عنصر را به یک رویداد analytics (click یا visible) وصل می‌کند.
  if (el.hasAttribute('zen-track')) {
    const trackAttr = el.getAttribute('zen-track')!;
    disposes.push(processTrack(el, trackAttr, context));
    trackDirective(el, { directiveType: 'track', expression: trackAttr });
  }
}
