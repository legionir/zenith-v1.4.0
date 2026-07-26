// packages/runtime/src/walker.ts
//
// موتور اصلی Runtime: پیمایش درخت DOM و فعال‌سازی دایرکتیوها.
//
// این فایل قلب Runtime است. هر بار که Zen.start فراخوانی می‌شود:
//   1) Context از State ساخته می‌شود.
//   2) walker از root شروع به پیمایش می‌کند.
//   3) برای هر عنصر، دایرکتیوها شناسایی و فعال می‌شوند.
//   4) Effectهای ایجادشده در یک آرایه جمع می‌شوند تا در صورت نیاز
//      (مثلاً در zen-if=false یا teardown اپ) قابل dispose باشند.
//
// Memory Leak Prevention:
//   - walker آرایه‌ای از dispose functions نگه می‌دارد.
//   - processIf از این آرایه استفاده می‌کند تا Effectهای فرزندان را
//     در زمان unmount dispose کند.
//   - processFor (فاز ۵) همین الگو را برای هر آیتم لیست به‌کار می‌برد.

import { createContext } from './context';
import { processText } from './directives/text';
import { processShow } from './directives/show';
import { processHtml } from './directives/html';
// FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
// مثل processHtml اما به‌جای sanitizeHTML از sanitizeHTMLTrusted استفاده می‌کند
// (Identity function + dev warn). برای ثبت در processNodeDirectives ایمپورت شد.
import { processHtmlTrusted } from './directives/html-trusted';
import { processIf } from './directives/if';
// IMPROVEMENT-05 (v1.0.1): zen-else / zen-else-if chain processing
import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { processBind } from './directives/bind';
import { processModel } from './directives/model';
import { processFor } from './directives/for';
import { isComponent, processComponent } from '@zenith/components';
import { processRouter } from '@zenith/router';
import { processFetch } from '@zenith/data';
import { processResource } from '@zenith/resource';
// FEATURE (v0.5.0): zen-animate — Web Animations API directive processor.
// این تابع در dispatch زیر برای هر عنصر با attribute `zen-animate` صدا زده
// می‌شود. خود تابع در @zenith/transition تعریف شده تا runtime به keyframes
// و presetها وابسته‌ی compile-time نداشته باشد.
import { processAnimate } from '@zenith/transition';
// FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
//  - zen-portal:        جابجایی عنصر به یک container دیگر (مثلاً modal به body).
//  - zen-intersection:  اجرای callback وقتی عنصر وارد viewport می‌شود (lazy-load).
//  - zen-cloak:         حذف attribute برای visible شدن عنصر (ضد FOUC).
//  - zen-ref:           bind کردن عنصر DOM به یک Signal در State.
import { processPortal } from './directives/portal';
import { processIntersection } from './directives/intersection';
import { processCloak } from './directives/cloak';
import { processRef } from './directives/ref';
// FEATURE (v1.0.0): zen-suspense — Suspense-like loading state with fallback, timeout, error.
import { processSuspense } from '@zenith/suspense';
// BUG-1 FIX (v1.2.2): zen-error dispatch — walker never imported processErrorBoundary.
// اکنون zen-error attribute به processErrorBoundary دیسپچ می‌شود تا error boundary
// محلی فعال شود (قبلاً این کد مرده بود و zen-error هیچ اثری نداشت).
import { processErrorBoundary } from '@zenith/error-boundary';
// FEATURE (v1.2.0): v1.2.x directives — restored in v1.2.2.
//  - zen-memo:        memoize subtree processing by expression value.
//  - zen-island:      defer child processing (visible/idle/load).
//  - zen-virtual:     virtual scrolling for large lists.
//  - zen-button:      stateful button with idle/loading/success/error states.
//  - zen-optimistic:  optimistic update with rollback on action failure.
//  - zen-track:       analytics tracking (click / visible triggers).
//  - zen-date-picker: Persian (Jalali) date picker web component.
import { processMemo } from './directives/memo';
import { processIsland } from './directives/island';
import { processVirtualRepeat } from './directives/virtual-repeat';
import { processStatefulButton } from './directives/stateful-button';
import { processOptimistic } from './directives/optimistic';
import { processTrack } from './directives/track';
import { processDatePicker } from './directives/date-picker';

// ─────────────────────────────────────────────────────────────
// FEATURE (v0.6.0): Custom Directive Registry
// ─────────────────────────────────────────────────────────────
//
// این registry به پلاگین‌ها (مثل @zenith/stateful) اجازه می‌دهد تا
// handlerهای خود را برای تگ‌های سفارشی ثبت کنند. walker هنگام پیمایش،
// اگر به تگی برسد که در این registry ثبت شده باشد، handler آن را فراخوانی
// کرده و بقیه‌ی دایرکتیوهای معمول روی همان تگ و فرزندانش را پردازش
// نمی‌کند (چون handler خودش مسئول محتوای داخلی است).
//
// مثال استفاده (در یک پلاگین):
//   registerCustomDirective('zen-resource-view', processResourceView, 'config');
//   registerCustomDirective('zen-action-button', processActionButton, 'action');
//   registerCustomDirective('zen-auth-view', processAuthView, 'config');
//
// در HTML:
//   <zen-resource-view config="$usersResource">...</zen-resource-view>
//
// نکته: کلیدها به‌صورت lowercase ذخیره می‌شوند چون HTML تگ‌ها را
// case-insensitive می‌کند.

/**
 * امضای handler یک custom directive.
 *
 * @param el         عنصر HTML (تگ سفارشی مثل <zen-resource-view>).
 * @param configAttr مقدار attribute پیکربندی (مثلاً مقدار `config` یا `action`).
 * @param context    Context والد (شامل getterهای `$user` و ...).
 * @param state      آبجکت State اصلی (شامل Signalها و Services).
 * @returns تابع Dispose برای پاکسازی Effectها و listenerها.
 */
export type CustomDirectiveHandler = (
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
) => () => void;

/**
 * ثبت‌نام یک custom directive در registry.
 *
 * @param attributeName نام attributeای که به‌عنوان `configAttr` به handler پاس داده می‌شود.
 *                     پیش‌فرض: `'config'`. مثال: برای zen-action-button، `'action'`.
 */
interface CustomDirectiveRegistration {
  attributeName: string;
  handler: CustomDirectiveHandler;
}

const customDirectiveRegistry = new Map<string, CustomDirectiveRegistration>();

/**
 * ثبت یک custom directive برای یک تگ سفارشی.
 *
 * @param tagName       نام تگ (case-insensitive). مثلاً `'zen-resource-view'`.
 * @param handler       تابع پردازشگر.
 * @param attributeName نام attributeای که به‌عنوان `configAttr` استخراج می‌شود.
 *                     پیش‌فرض `'config'`.
 */
export function registerCustomDirective(
  tagName: string,
  handler: CustomDirectiveHandler,
  attributeName: string = 'config',
): void {
  if (typeof tagName !== 'string' || tagName.length === 0) {
    console.warn('[Zenith] registerCustomDirective: tagName must be a non-empty string.');
    return;
  }
  if (typeof handler !== 'function') {
    console.warn(`[Zenith] registerCustomDirective: handler for "${tagName}" must be a function.`);
    return;
  }
  customDirectiveRegistry.set(tagName.toLowerCase(), { attributeName, handler });
}

/**
 * حذف یک custom directive از registry.
 */
export function unregisterCustomDirective(tagName: string): boolean {
  return customDirectiveRegistry.delete(tagName.toLowerCase());
}

/**
 * پاکسازی کل registry (فقط برای تست‌ها و teardown کامل).
 */
export function clearCustomDirectives(): void {
  customDirectiveRegistry.clear();
}

/**
 * دریافت handler یک custom directive (برای دیباگ و DevTools).
 */
export function getCustomDirective(tagName: string): CustomDirectiveHandler | undefined {
  return customDirectiveRegistry.get(tagName.toLowerCase())?.handler;
}

/**
 * بررسی وجود یک custom directive در registry.
 *
 * @param tagName نام تگ (case-insensitive). مثلاً `'zen-resource-view'`.
 * @returns true اگر directive قبلاً ثبت شده باشد.
 */
export function hasCustomDirective(tagName: string): boolean {
  return customDirectiveRegistry.has(tagName.toLowerCase());
}

// ─────────────────────────────────────────────────────────────
// FEATURE (v0.4.0): DevTools Dependency Graph integration
// ─────────────────────────────────────────────────────────────
// یک helper سبک که اگر DevTools فعال باشد (window.__ZENITH__ وجود داشته
// باشد)، دایرکتیوها و وابستگی‌هایشان را در گراف ثبت می‌کند. اگر DevTools
// فعال نباشد، تمام فراخوانی‌ها no-op می‌شوند — یعنی zero overhead در
// Production.
const __elIdMap = new WeakMap<HTMLElement, number>();
let __elIdCounter = 0;
function __devtools(): any {
  return typeof window !== 'undefined' ? (window as any).__ZENITH__ : null;
}
function __elId(el: HTMLElement): number {
  let id = __elIdMap.get(el);
  if (id === undefined) {
    id = ++__elIdCounter;
    __elIdMap.set(el, id);
  }
  return id;
}
/**
 * ثبت یک دایرکتیو در گراف DevTools.
 * عبارت را برای یافتن ارجاعات `$var` (به‌صورت best-effort) بررسی می‌کند
 * و یال‌های read-by / drives / updates را ثبت می‌کند.
 *
 * نکته: این تابع هرگز نباید exception بروز دهد — تمام بدنه‌ی آن در
 * try/catch پیچیده شده تا DevTools نتواند runtime را خراب کند.
 */
function __trackDirective(
  el: HTMLElement,
  directiveType: string,
  expression: string,
): void {
  const dt = __devtools();
  if (!dt || typeof dt.addDirective !== 'function') return;
  try {
    const eid = __elId(el);
    const tag = el.tagName.toLowerCase();
    const directiveId = `dir:${directiveType}:${eid}`;
    const effectId = `eff:${directiveId}`;
    const domId = `dom:${tag}#${eid}`;
    const selector = `${tag}[data-zid="${eid}"]`;
    dt.addDirective(directiveId, directiveType, selector, expression);
    dt.addEffect(effectId, []);
    dt.addDom(domId, tag);
    dt.recordWrite(effectId, directiveId);
    dt.recordDomUpdate(directiveId, domId);
    // یافتن ارجاعات $var در عبارت (best-effort با regex سبک).
    const refs = expression.match(/\$([a-zA-Z_]\w*)/g) || [];
    const seen = new Set<string>();
    for (const ref of refs) {
      const sigName = ref.slice(1);
      if (seen.has(sigName)) continue;
      seen.add(sigName);
      dt.addSignal(sigName, sigName, undefined);
      dt.recordRead(sigName, effectId);
    }
  } catch {
    // DevTools نباید هرگز جریان runtime را قطع کند.
  }
}

/**
 * پردازش کامل یک DOM root با State داده‌شده.
 *
 * این تابع نقطه‌ی ورود اصلی Runtime است.
 *
 * @param root عنصر ریشه که باید process شود.
 * @param state آبجکت State (شامل Signalها، Services، و ...).
 */
export function processDOM(root: HTMLElement, state: Record<string, any>): void {
  const context = createContext(state);
  const disposes: (() => void)[] = [];
  walk(root, context, state, disposes);

  // ذخیره‌ی disposes روی root برای استفاده‌های بعدی
  // (مثلاً HMR در DevTools یا teardown کامل اپ)
  (root as any).__zenithDisposes = disposes;
}

/**
 * FEATURE (v0.4.0): پیاده‌سازی سبک‌وزنِ processDOM برای استفاده‌ی per-clone
 * در zen-for کامپایل‌شده و سایر کاربردهایی که نیاز به bind کردن یک زیردرخت
 * دارند بدون re-init کردنِ Event Delegation سراسری یا reset کردن Resource
 * Registry.
 *
 * تفاوت با processDOM:
 *   - این تابع disposes را روی root ذخیره نمی‌کند (root.__zenithDisposes ست
 *     نمی‌شود) چون این زیردرخت توسط parent teardown مدیریت می‌شود.
 *   - Event Delegation را re-init نمی‌کند (Zen.start قبلاً یک‌بار برای کل
 *     document این کار را کرده است).
 *   - resetResourceRegistry فراخوانی نمی‌شود.
 *
 * مورد استفاده‌ی اصلی: processChildren callback در zen-for کامپایل‌شده.
 * قبل از v0.4.0، processChildren به Zen.start سپرده می‌شد که در هر clone:
 *   ۱) Event Delegation را دوباره init می‌کرد (wasteful + leak اگر teardown
 *      نمی‌شد).
 *   ۲) Effectهای فرزندان را روی root.__zenithDisposes می‌گذاشت که هرگز توسط
 *      کسی پاکسازی نمی‌شدند (چون clone هیچ‌گاه به Zen.stop پاس داده نمی‌شد) →
 *      نشت حافظه‌ی قطعی هنگام removal آیتم‌های لیست.
 *
 * حالا walkAndBind یک تابع teardown برمی‌گرداند که compiler-generated کدِ
 * zen-for آن را در `__entry.dispose` ذخیره می‌کند و هنگام removal آیتم صدا
 * می‌زند → Effectهای فرزندان clone پاکسازی می‌شوند.
 *
 * @param root  عنصر ریشه‌ی زیردرخت.
 * @param state آبجکت State (شامل Signalهای محلی).
 * @returns تابع teardown که تمام Effectهای ایجادشده را dispose می‌کند.
 */
export function walkAndBind(
  root: HTMLElement,
  state: Record<string, any>,
): () => void {
  const context = createContext(state);
  const disposes: (() => void)[] = [];
  walk(root, context, state, disposes);

  // FEATURE (v0.4.0): بازگرداندن یک تابع teardown واحد که همه‌ی disposes را
  // فراخوانی می‌کند. این تابع توسط zen-for compiler-generated کد در زمان
  // removal یک آیتم فراخوانی می‌شود تا Effectهای فرزندان clone پاکسازی شوند.
  return () => {
    for (const dispose of disposes) {
      try {
        dispose();
      } catch (err) {
        // FEATURE (v0.4.0): خطای یک dispose نباید مانع dispose بقیه شود.
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Zenith walkAndBind] dispose failed:', err);
        }
      }
    }
    disposes.length = 0;
  };
}

/**
 * پیمایش بازگشتی DOM و فعال‌سازی دایرکتیوها.
 *
 * @param node نود فعلی (می‌تواند Text Node باشد).
 * @param context Context ساخته‌شده از State.
 * @param state State اصلی.
 * @param disposes آرایه‌ای که dispose functions در آن جمع می‌شوند.
 */

/**
 * IMPROVEMENT-05 (v1.0.1): پردازش زنجیره if-else-if-else.
 *
 * زنجیره را از عنصر if شروع می‌کند و sibling های بعدی را بررسی می‌کند.
 * اولین branch که condition آن true است نمایش داده می‌شود، بقیه مخفی می‌شوند.
 *
 * FIX (v1.2.8): P0-1 — این تابع قبلاً فقط `style.display` را toggle می‌کرد
 * که باعث می‌شد branchهای غیرفعال در DOM باقی بمانند، Effectهای فرزندانشان
 * فعال بماند، و Event Listenerها/Zen-for/Zen-fetch داخل branchهای مخفی
 * همچنان کار کنند. این دقیقاً همان باگی بود که processIf برای جلوگیری از
 * آن طراحی شده بود (رجوع کنید به directives/if.ts).
 *
 * پیاده‌سازی جدید از mount/unmount با comment placeholder استفاده می‌کند:
 *   1) هر عنصر در زنجیره با یک Comment جایگزین می‌شود (خارج از DOM).
 *   2) Effect اولین branch با condition=true را انتخاب می‌کند.
 *   3) mountBranch: عنصر را قبل از placeholder درج می‌کند و children را
 *      با یک disposes array تازه walk می‌کند.
 *   4) unmountBranch: disposes فرزندان را اجرا می‌کند و عنصر را از DOM
 *      حذف می‌کند (placeholder باقی می‌ماند تا re-mount ممکن باشد).
 *   5) فقط branch فعال children با Effect فعال دارد.
 */
function processIfChain(
  ifEl: HTMLElement,
  ifExpr: string,
  context: Record<string, any>,
  state: Record<string, any>,
  // Explicit signature: `typeof walk` here refers to this parameter, not the
  // outer function, which makes the annotation circular (TS2502).
  walk: (
    node: Node,
    context: Record<string, any>,
    state: Record<string, any>,
    disposes: (() => void)[],
  ) => void,
): () => void {
  // جمع‌آوری زنجیره
  const chain: Array<{ el: HTMLElement; expr: string | null }> = [
    { el: ifEl, expr: ifExpr },
  ];

  let next = ifEl.nextElementSibling as HTMLElement | null;
  while (next) {
    if (next.hasAttribute('zen-else-if')) {
      chain.push({ el: next, expr: next.getAttribute('zen-else-if') });
      next = next.nextElementSibling as HTMLElement | null;
    } else if (next.hasAttribute('zen-else')) {
      chain.push({ el: next, expr: null });
      break;
    } else {
      break;
    }
  }

  // compile همه expressions (یک‌بار)
  const evalFns = chain.map(({ expr }) =>
    expr ? compileExpression(expr) : () => true,
  );

  // FIX (v1.2.8): P0-1 — برای هر branch یک Comment placeholder بساز و عنصر
  // را با آن جایگزین کن. عنصر در حافظه نگه داشته می‌شود؛ mountBranch آن را
  // قبل از placeholder درج می‌کند وقتی branch فعال شود.
  const placeholders: Comment[] = [];
  const parents: (HTMLElement | null)[] = [];
  for (const c of chain) {
    const parent = c.el.parentElement;
    parents.push(parent);
    const ph = document.createComment('zen-if-chain');
    placeholders.push(ph);
    if (parent) {
      parent.replaceChild(ph, c.el);
    }
  }

  // هر branch یک dispose bucket اختصاصی دارد — فقط branch فعال disposes زنده دارد.
  const branchDisposes: Array<Array<() => void>> = chain.map(() => []);

  function mountBranch(i: number): void {
    const c = chain[i]!;
    const ph = placeholders[i]!;
    const parent = parents[i];
    if (!parent) return;
    // درج مجدد عنصر قبل از placeholder
    parent.insertBefore(c.el, ph);
    // حذف attributeهای ساختاری تا walker دوباره وارد زنجیره نشود
    c.el.removeAttribute('zen-if');
    c.el.removeAttribute('zen-else-if');
    c.el.removeAttribute('zen-else');
    c.el.removeAttribute('data-zenith-else-handled');
    // walk این branch — disposes تازه در branchDisposes[i] ذخیره می‌شوند
    const disposes: (() => void)[] = [];
    walk(c.el, context, state, disposes);
    branchDisposes[i] = disposes;
  }

  function unmountBranch(i: number): void {
    const c = chain[i]!;
    const parent = parents[i];
    // ابتدا disposes فرزندان را اجرا کن
    const ds = branchDisposes[i]!;
    for (const d of ds) {
      try { d(); } catch { /* یک dispose failure نباید بقیه را متوقف کند */ }
    }
    branchDisposes[i] = [];
    // عنصر را از DOM حذف کن (placeholder باقی می‌ماند برای re-mount)
    if (parent && c.el.parentNode === parent) {
      parent.removeChild(c.el);
    }
  }

  let activeIndex = -1;

  const dispose = effect(() => {
    // انتخاب اولین branch با condition=true
    let newIndex = -1;
    for (let i = 0; i < chain.length; i++) {
      try {
        if (Boolean(evalFns[i]!(context))) {
          newIndex = i;
          break;
        }
      } catch {
        // خطای expression در یک branch → treat as false، ادامه بده
      }
    }
    if (newIndex === activeIndex) return;
    // unmount branch قبلی (در صورت وجود)
    if (activeIndex !== -1) {
      unmountBranch(activeIndex);
    }
    // mount branch جدید (در صورت وجود)
    if (newIndex !== -1) {
      mountBranch(newIndex);
    }
    activeIndex = newIndex;
  });

  return () => {
    dispose();
    if (activeIndex !== -1) {
      unmountBranch(activeIndex);
      activeIndex = -1;
    }
    // حذف همه placeholderها
    for (let i = 0; i < placeholders.length; i++) {
      const ph = placeholders[i]!;
      const parent = parents[i];
      if (parent && ph.parentNode === parent) {
        parent.removeChild(ph);
      }
    }
  };
}
function walk(
  node: Node,
  context: Record<string, any>,
  state: Record<string, any>,
  disposes: (() => void)[],
): void {
  // فقط Element Nodes قابل process هستند.
  // Text Nodes و Comment Nodes نادیده گرفته می‌شوند.
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;

  // ── ۰. zen-virtual (FEATURE v1.2.0): virtual scrolling ──
  // zen-virtual باید قبل از zen-for چک شود چون معمولاً با zen-for روی همان
  // عنصر ترکیب می‌شود (zen-virtual + zen-for). اگر هر دو حضور دارند،
  // processVirtualRepeat کل لیست را به‌صورت virtual render می‌کند و zen-for
  // نباید دوباره پردازش شود.
  if (el.hasAttribute('zen-virtual')) {
    // zen-virtual می‌تواند به‌تنهایی (با forExpr درون خودش) یا همراه با zen-for
    // بیاید. در هر دو حالت، processVirtualRepeat را فراخوانی می‌کنیم.
    const virtualExpr = el.getAttribute('zen-virtual')!;
    const forExpr = el.getAttribute('zen-for') || virtualExpr;

    const processChildren = (
      newNode: HTMLElement,
      localContext: Record<string, any>,
      itemDisposes: (() => void)[],
    ): void => {
      processNodeDirectives(newNode, localContext, state, itemDisposes);
      for (const child of Array.from(newNode.children)) {
        walk(child, localContext, state, itemDisposes);
      }
    };

    disposes.push(processVirtualRepeat(el, forExpr, context, processChildren));
    return; // بقیه دایرکتیوها (از جمله zen-for) روی این عنصر پردازش نمی‌شوند.
  }

  // ── ۱. zen-for: رندر لیست ──
  // zen-for باید قبل از همه‌ی دایرکتیوهای دیگر چک شود چون:
  //   1) کل عنصر (و فرزندانش) را با چندین clone جایگزین می‌کند.
  //   2) نباید walker معمول روی فرزندان template اجرا شود.
  //   3) می‌تواند با zen-if ترکیب نشود (هر عنصر فقط یک structural directive).
  if (el.hasAttribute('zen-for')) {
    const forExpr = el.getAttribute('zen-for')!;

    // processChildren callback: وقتی یک آیتم جدید ساخته می‌شود، فراخوانی می‌شود.
    // این callback باید فرزندان نود تازه‌ساخته‌شده را با context محلی walk کند
    // و disposes آن‌ها را در آرایه‌ی اختصاصی همان آیتم جمع کند.
    //
    // نکته: خود نود آیتم (مثل <li>) هم باید walk شود چون ممکن است روی خودش
    // دایرکتیوهایی مثل zen-bind:class یا zen-text داشته باشد. اما چون فرزندان
    // نود آیتم در walker معمول بررسی می‌شوند، کافی است خود نود و سپس فرزندانش
    // walk شوند.
    const processChildren = (
      newNode: HTMLElement,
      localContext: Record<string, any>,
      itemDisposes: (() => void)[],
    ): void => {
      // ابتدا دایرکتیوهای روی خود نود آیتم (مثل zen-text, zen-bind:*) را process کن.
      // این کد شبیه بخش‌های ۲-۴ در walk معمول است اما با localContext.
      processNodeDirectives(newNode, localContext, state, itemDisposes);

      // سپس فرزندان را walk کن.
      for (const child of Array.from(newNode.children)) {
        walk(child, localContext, state, itemDisposes);
      }
    };

    disposes.push(processFor(el, forExpr, context, processChildren));
    return; // بقیه دایرکتیوها روی خود el پردازش نمی‌شوند.
  }

  // ── ۲. zen-if: اگر false بود، بقیه را process نکن ──
  // zen-if اولویت بالاتری نسبت به سایر دایرکتیوها دارد چون می‌تواند
  // کل عنصر (و فرزندانش) را از DOM حذف کند.
  if (el.hasAttribute('zen-if')) {
    const expr = el.getAttribute('zen-if')!;

    // IMPROVEMENT-05 (v1.0.1): بررسی zen-else-if و zen-else در sibling ها
    // اگر زنجیره if-else-if-else وجود دارد، از processIfChain استفاده می‌کنیم.
    const nextSibling = el.nextElementSibling as HTMLElement | null;
    const hasElseChain = nextSibling && (
      nextSibling.hasAttribute('zen-else-if') || nextSibling.hasAttribute('zen-else')
    );

    if (hasElseChain) {
      // پردازش زنجیره if-else-if-else
      disposes.push(processIfChain(el, expr, context, state, walk));
      // عناصر else-if و else توسط processIfChain مدیریت می‌شوند — از walk حذف می‌کنیم
      // با marking آنها
      let next: HTMLElement | null = nextSibling;
      while (next) {
        if (next.hasAttribute('zen-else-if') || next.hasAttribute('zen-else')) {
          next.setAttribute('data-zenith-else-handled', 'true');
          if (next.hasAttribute('zen-else')) break;
          next = next.nextElementSibling as HTMLElement | null;
        } else {
          break;
        }
      }
      // FIX (v1.2.8): P0-1 — processIfChain اکنون همه‌ی عناصر زنجیره را با
      // comment placeholder جایگزین می‌کند و فقط branch فعال را mount می‌کند.
      // نباید walk(el) را اینجا صدا بزنیم چون el دیگر در DOM نیست (با placeholder
      // جایگزین شده) و mountBranch داخل processIfChain هنگام فعال شدن branch،
      // walk را با disposes array اختصاصی آن branch صدا می‌زند. مدیریت children
      // کاملاً به processIfChain سپرده شده است.
      return;
    }

    // manageChildren یک closure است که وقتی zen-if true شود فراخوانی می‌شود.
    const manageChildren = (): (() => void)[] => {
      const childDisposes: (() => void)[] = [];
      walk(el, context, state, childDisposes);
      return childDisposes;
    };

    disposes.push(processIf(el, expr, context, manageChildren));
    return;
  }

  // IMPROVEMENT-05 (v1.0.1): skip عناصر else-if/else که توسط زنجیره if هندل شده‌اند
  if (el.hasAttribute('data-zenith-else-handled')) {
    el.removeAttribute('data-zenith-else-handled');
    // FIX (v1.2.8): P0-1 — این عنصر توسط processIfChain مدیریت می‌شود و
    // احتمالاً از DOM حذف شده (با placeholder جایگزین شده). children آن توسط
    // mountBranch در processIfChain walk می‌شوند وقتی branch فعال می‌شود.
    // بنابراین اینجا فقط return می‌کنیم و چیزی walk نمی‌کنیم.
    return;
  }
  // اگر zen-else یا zen-else-if دارد ولی هندل نشده (یعنی zen-if والد نداشته)
  if (el.hasAttribute('zen-else') || el.hasAttribute('zen-else-if')) {
    // orphan else — نادیده بگیر و children را walk کن
    walkChildren(el, context, state, disposes);
    return;
  }

  // ── ۳. کامپوننت‌های سفارشی (فاز ۶) ──
  // اگر تگ فعلی یک کامپوننت ثبت‌شده است (مثل <app-product-card>)، آن را با
  // processComponent پردازش می‌کنیم. این تابع:
  //   - Props را ارزیابی می‌کند.
  //   - Slotها را پر می‌کند.
  //   - Context محلی را می‌سازد.
  //   - فرزندان را با Context مناسب (محلی برای قالب، parent برای slot content) walk می‌کند.
  //
  // اولویت: بعد از zen-if و zen-for، اما قبل از دایرکتیوهای معمول.
  // چون اگر کامپوننت باشد، نباید دایرکتیوهای معمول روی خود تگ اعمال شود
  // (دایرکتیوها داخل قالب کامپوننت پردازش می‌شوند).
  if (isComponent(el.tagName)) {
    processComponent(
      el,
      context,
      // processChildren callback:
      // برای هر فرزند، walk را با Context مناسب فراخوانی می‌کند.
      // - isSlotContent=true → parentContext (محل استفاده)
      // - isSlotContent=false → localContext (داخل قالب کامپوننت)
      (childNode, childContext, childDisposes, _isSlotContent) => {
        walk(childNode, childContext, state, childDisposes);
      },
      disposes,
    );
    return; // فرزندان کامپوننت درون processComponent پردازش می‌شوند.
  }

  // ── ۴. zen-router (فاز ۸) ──
  // اگر تگ فعلی <zen-router> است، آن را با processRouter پردازش می‌کنیم.
  // این تابع:
  //   - تعاریف <zen-route> را می‌خواند.
  //   - بر اساس مسیر فعلی، فایل HTML را fetch می‌کند.
  //   - دایرکتیوهای HTML جدید را process می‌کند.
  //
  // اولویت: بعد از کامپوننت‌ها، اما قبل از دایرکتیوهای معمول.
  if (el.tagName.toLowerCase() === 'zen-router') {
    processRouter(
      el,
      // processChildren callback:
      // وقتی HTML جدید لود شد، فرزندان آن را با context والد walk می‌کند.
      // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
      // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
      (childNode, childDisposes) => {
        walk(childNode, context, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  // ── ۴a. FEATURE (v1.0.0): zen-suspense ──
  // اگر تگ فعلی <zen-suspense> است، آن را با processSuspense پردازش می‌کنیم.
  // این دایرکتیو یک SuspenseContext می‌سازد که zen-fetch و zen-resource
  // می‌توانند به آن گزارش دهند. fallback، timeout و error پشتیبانی می‌شوند.
  if (el.tagName.toLowerCase() === 'zen-suspense') {
    processSuspense(
      el,
      // processChildren callback:
      (childNode, childContext, childDisposes) => {
        walk(childNode, childContext, state, childDisposes);
      },
      context,
      disposes,
    );
    return;
  }

  // ── ۴a-bis. BUG-1 FIX (v1.2.2): zen-error — Error Boundary محلی ──
  // اگر عنصر دارای attribute `zen-error` است، آن را با processErrorBoundary
  // پردازش می‌کنیم. این تابع یک local error boundary می‌سازد که fallback
  // template را در صورت خطا در Expressionهای فرزندان نمایش می‌دهد.
  // قبلاً این dispatch پیاده‌سازی نشده بود و zen-error یک attribute مرده بود.
  if (el.hasAttribute('zen-error')) {
    processErrorBoundary(
      el,
      (childNode, childDisposes) => {
        walk(childNode, context, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  // ── ۴a-ter. FEATURE (v1.2.0): zen-memo — Memoized subtree ──
  // فرزندان عنصر را در یک Effect می‌پیچد که فقط زمانی دوباره پردازش
  // می‌شود که مقدار Expression تغییر کند (با Object.is مقایسه می‌شود).
  // این کار برای زیردرخت‌های سنگین سودمند است که نباید با هر تغییر
  // state دوباره render شوند.
  if (el.hasAttribute('zen-memo')) {
    const memoExpr = el.getAttribute('zen-memo')!;
    disposes.push(processMemo(
      el,
      memoExpr,
      context,
      (nodeEl, nodeCtx, nodeDisposes) => {
        processNodeDirectives(nodeEl, nodeCtx, state, nodeDisposes);
        for (const child of Array.from(nodeEl.children)) {
          walk(child, nodeCtx, state, nodeDisposes);
        }
      },
    ));
    return;
  }

  // ── ۴a-quart. FEATURE (v1.2.0): zen-date-picker — Persian date picker ──
  // اگر تگ فعلی <zen-date-picker> است، custom element را ثبت می‌کنیم.
  // خود custom element چرخه‌ی حیات خودش را مدیریت می‌کند، پس فقط تضمین
  // می‌کنیم که کلاس ثبت شده باشد.
  if (el.tagName.toLowerCase() === 'zen-date-picker') {
    disposes.push(processDatePicker(el, context));
    // نیازی به return نیست؛ فرزندان (در صورت وجود) به‌صورت عادی walk می‌شوند.
  }

  // ── ۴a-quint. FEATURE (v1.2.0): zen-island — Deferred hydration ──
  // پردازش فرزندان را تا زمانی که شرط hydration (visible/idle/load)
  // برقرار شود، به تعویق می‌اندازد. قبل از custom directives چک می‌شود
  // تا island ها بتوانند کل زیردرخت را کنترل کنند.
  if (el.hasAttribute('zen-island')) {
    const hydrateMode = el.getAttribute('zen-island') || 'load';
    disposes.push(processIsland(
      el,
      hydrateMode,
      context,
      (nodeEl, nodeCtx, nodeDisposes) => {
        processNodeDirectives(nodeEl, nodeCtx, state, nodeDisposes);
        for (const child of Array.from(nodeEl.children)) {
          walk(child, nodeCtx, state, nodeDisposes);
        }
      },
    ));
    return;
  }

  // ── ۴a-sext. FEATURE (v1.2.0): zen-button — Stateful button ──
  // عنصر را با یک <button> واقعی جایگزین می‌کند که چرخه‌ی حیات
  // idle/loading/success/error را مدیریت می‌کند. قبل از custom directives
  // چک می‌شود تا attribute آن حذف شود و فرآیند جایگزینی انجام گیرد.
  if (el.hasAttribute('zen-button')) {
    const actionName = el.getAttribute('zen-button') || '';
    const loadingText = el.getAttribute('data-loading-text');
    disposes.push(processStatefulButton(el, actionName, loadingText, context));
    return;
  }

  // ── ۴ب. FEATURE (v0.6.0): Custom Directive Tags ──
  // اگر تگ فعلی در customDirectiveRegistry ثبت شده باشد (مثلاً
  // <zen-resource-view>، <zen-action-button>، <zen-auth-view>)، handler
  // آن را فراخوانی می‌کنیم. handler مسئول کاملِ محتوای داخلی است و
  // بقیه‌ی دایرکتیوهای معمول روی همین تگ و فرزندانش پردازش نمی‌شوند.
  //
  // attributeName از registration خوانده می‌شود (مثلاً `config` برای
  // zen-resource-view، `action` برای zen-action-button). مقدار آن به‌عنوان
  // `configAttr` به handler پاس داده می‌شود.
  //
  // اولویت: بعد از zen-router، قبل از zen-resource/zen-fetch و دایرکتیوهای
  // معمول. چون این تگ‌های سفارشی اختصاصی هستند و نباید با دایرکتیوهای
  // معمول تداخل کنند.
  const customReg = customDirectiveRegistry.get(el.tagName.toLowerCase());
  if (customReg) {
    const configAttrValue = el.getAttribute(customReg.attributeName);
    disposes.push(customReg.handler(el, configAttrValue, context, state));
    return; // فرزندان توسط handler خودش مدیریت می‌شوند.
  }

  // ── ۵‌ب. zen-resource (فاز ۳ Business) ──
  if (el.hasAttribute('zen-resource')) {
    const resourceExpr = el.getAttribute('zen-resource')!;
    processResource(
      el, resourceExpr, context,
      (childNode, childContext, childDisposes) => { walk(childNode, childContext, state, childDisposes); },
      disposes,
    );
    return;
  }

  // ── ۵. zen-fetch (فاز ۸) ──
  // اگر عنصر دارای attribute `zen-fetch` است، آن را با processFetch پردازش
  // می‌کنیم. این تابع:
  //   - یک Signal محلی برای وضعیت fetch می‌سازد.
  //   - Context محلی می‌سازد که $<stateName> به آن Signal اشاره می‌کند.
  //   - فرزندان را با Context محلی walk می‌کند.
  //   - یک Effect ایجاد می‌کند که URL را watch می‌کند و fetch انجام می‌دهد.
  if (el.hasAttribute('zen-fetch')) {
    const fetchExpr = el.getAttribute('zen-fetch')!;
    processFetch(
      el,
      fetchExpr,
      context,
      // processChildren callback:
      // فرزندان با Context محلی (شامل $<stateName>) walk می‌شوند.
      // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
      // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
      (childNode, childContext, childDisposes) => {
        walk(childNode, childContext, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  // ── ۶. دایرکتیوهای معمول روی این نود ──
  // ── zen-show (visibility toggle without DOM removal) ──
  if (el.hasAttribute('zen-show')) {
    const showExpr = el.getAttribute('zen-show')!;
    disposes.push(processShow(el, showExpr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'show', showExpr);
  }

  // ── zen-animate (FEATURE v0.5.0): انیمیشن مبتنی بر Web Animations API ──
  // این دایرکتیو یک‌بار روی mount اجرا می‌شود و یک keyframe animation را روی
  // عنصر با el.animate() اجرا می‌کند. برخلاف zen-transition، نیازی به CSS
  // ندارد و attribute پس از process حذف می‌شود تا در re-walk تکرار نشود.
  // تابع processAnimate یک no-op dispose برمی‌گرداند چون انیمیشن خودش را
  // پس از پایان با anim.cancel() پاک می‌کند.
  // SSR-safe: اگر el.animate وجود نداشته باشد، processAnimate بلافاصله
  // no-op می‌شود.
  if (el.hasAttribute('zen-animate')) {
    const animateAttr = el.getAttribute('zen-animate')!;
    disposes.push(processAnimate(el, animateAttr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'animate', animateAttr);
  }

  processNodeDirectives(el, context, state, disposes);

  // ── ۸. پیمایش بازگشتی فرزندان ──
  walkChildren(el, context, state, disposes);
}

/**
 * پردازش دایرکتیوهای non-structural روی یک نود.
 *
 * این تابع توسط walk اصلی و توسط processChildren در zen-for استفاده می‌شود.
 * در هر دو حالت، دایرکتیوهای zen-text, zen-bind:*, zen-model روی نود فعلی
 * پردازش می‌شوند و disposes آن‌ها در آرایه‌ی داده‌شده جمع می‌شوند.
 *
 * @param el       عنصر HTML.
 * @param context  Context (می‌تواند context محلی در zen-for باشد).
 * @param state    State اصلی.
 * @param disposes آرایه‌ی dispose functions.
 */
function processNodeDirectives(
  el: HTMLElement,
  context: Record<string, any>,
  state: Record<string, any>,
  disposes: (() => void)[],
): void {
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
    __trackDirective(el, 'html-trusted', expr);
  } else if (el.hasAttribute('zen-html')) {
    const expr = el.getAttribute('zen-html')!;
    disposes.push(processHtml(el, expr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'html', expr);
  } else if (el.hasAttribute('zen-text')) {
    const expr = el.getAttribute('zen-text')!;
    disposes.push(processText(el, expr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'text', expr);
  }

  // ── zen-bind:*: اتصال به Attribute ──
  // ممکن است چندین zen-bind:* روی یک عنصر باشند.
  // Array.from برای جلوگیری از تغییر در حین iteration لازم است.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('zen-bind:')) {
      const attrName = attr.name.slice('zen-bind:'.length);
      disposes.push(processBind(el, attrName, attr.value, context));
      // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
      __trackDirective(el, `bind:${attrName}`, attr.value);
    }
  }

  // ── zen-model: Two-way binding ──
  if (el.hasAttribute('zen-model')) {
    const expr = el.getAttribute('zen-model')!;
    disposes.push(processModel(el, expr, context, state));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'model', expr);
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
    __trackDirective(el, 'portal', targetSelector);
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
    __trackDirective(el, 'intersection', callbackExpr);
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
    __trackDirective(el, 'ref', refName);
  }

  // ── zen-cloak: حذف attribute برای visible شدن عنصر (ضد FOUC) ──
  // این دایرکتیو باید **آخرین** دایرکتیوی باشد که اجرا می‌شود چون کار آن
  // این است که پس از پردازش تمام دایرکتیوهای دیگر، عنصر را visible کند.
  // اگر زودتر اجرا شود، کاربر برای یک لحظه محتوای پردازش‌نشده می‌بیند.
  // CSS: `[zen-cloak] { display: none; }`
  if (el.hasAttribute('zen-cloak')) {
    disposes.push(processCloak(el));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    __trackDirective(el, 'cloak', '');
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
    __trackDirective(el, 'optimistic', optimisticExpr);
  }

  // ── zen-track: analytics tracking ──
  // عنصر را به یک رویداد analytics (click یا visible) وصل می‌کند.
  if (el.hasAttribute('zen-track')) {
    const trackAttr = el.getAttribute('zen-track')!;
    disposes.push(processTrack(el, trackAttr, context));
    __trackDirective(el, 'track', trackAttr);
  }
}

/**
 * پیمایش فرزندان یک عنصر و جمع‌آوری disposes.
 *
 * این تابع به صورت جداگانه تعریف شده تا در processIf (که نیاز به
 * walk کردن فرزندان یک عنصر mount شده دارد) قابل استفاده باشد.
 */
function walkChildren(
  el: HTMLElement,
  context: Record<string, any>,
  state: Record<string, any>,
  disposes: (() => void)[],
): void {
  // Array.from برای جلوگیری از تغییر Collection در حین iteration
  // (مثلاً وقتی zen-if یک عنصر را اضافه/حذف می‌کند)
  for (const child of Array.from(el.children)) {
    walk(child, context, state, disposes);
  }
}
