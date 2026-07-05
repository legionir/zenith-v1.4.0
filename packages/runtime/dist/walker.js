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
import { createContext } from './context.js';
import { processText } from './directives/text.js';
import { processShow } from './directives/show.js';
import { processHtml } from './directives/html.js';
// FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
// مثل processHtml اما به‌جای sanitizeHTML از sanitizeHTMLTrusted استفاده می‌کند.
import { processHtmlTrusted } from './directives/html-trusted.js';
import { processIf } from './directives/if.js';
import { processBind } from './directives/bind.js';
import { processModel } from './directives/model.js';
import { processFor } from './directives/for.js';
import { isComponent, processComponent } from '@zenith/components';
import { processRouter } from '@zenith/router';
import { processFetch } from '@zenith/data';
import { processResource } from '@zenith/resource';
// FEATURE (v0.5.0): zen-animate — Web Animations API directive processor.
import { processAnimate } from '@zenith/transition';
// FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
//  - zen-portal:        جابجایی عنصر به یک container دیگر (مثلاً modal به body).
//  - zen-intersection:  اجرای callback وقتی عنصر وارد viewport می‌شود (lazy-load).
//  - zen-cloak:         حذف attribute برای visible شدن عنصر (ضد FOUC).
//  - zen-ref:           bind کردن عنصر DOM به یک Signal در State.
import { processPortal } from './directives/portal.js';
import { processIntersection } from './directives/intersection.js';
import { processCloak } from './directives/cloak.js';
import { processRef } from './directives/ref.js';
// FEATURE (v1.0.0): zen-suspense — Suspense-like loading state with fallback, timeout, error.
import { processSuspense } from '@zenith/suspense';
// BUG-1 FIX (v1.2.2): zen-error dispatch — walker never imported processErrorBoundary.
import { processErrorBoundary } from '@zenith/error-boundary';
// FEATURE (v1.2.0): v1.2.x directives — restored in v1.2.2.
import { processMemo } from './directives/memo.js';
import { processIsland } from './directives/island.js';
import { processVirtualRepeat } from './directives/virtual-repeat.js';
import { processStatefulButton } from './directives/stateful-button.js';
import { processOptimistic } from './directives/optimistic.js';
import { processTrack } from './directives/track.js';
import { processDatePicker } from './directives/date-picker.js';
// IMPROVEMENT-05 (v1.0.1): zen-else / zen-else-if chain processing
import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
// نکته: reportError از @zenith/error-boundary در آینده برای catch کردن
// خطاهای Expression در دایرکتیوها استفاده خواهد شد. فعلاً فقط dependency
// در package.json ثبت شده است.
// ─────────────────────────────────────────────────────────────
// FEATURE (v0.6.0): Custom Directive Registry
// ─────────────────────────────────────────────────────────────
//
// این registry به پلاگین‌ها (مثل @zenith/stateful) اجازه می‌دهد تا
// handlerهای خود را برای تگ‌های سفارشی ثبت کنند. walker هنگام پیمایش،
// اگر به تگی برسد که در این registry ثبت شده باشد، handler آن را فراخوانی
// کرده و بقیه‌ی دایرکتیوهای معمول روی همان تگ و فرزندانش را پردازش
// نمی‌کند (چون handler خودش مسئول محتوای داخلی است).
/**
 * امضای handler یک custom directive.
 */
export const customDirectiveRegistry = new Map();
/**
 * ثبت یک custom directive برای یک تگ سفارشی.
 *
 * @param tagName       نام تگ (case-insensitive).
 * @param handler       تابع پردازشگر.
 * @param attributeName نام attributeای که به‌عنوان `configAttr` استخراج می‌شود (پیش‌فرض 'config').
 */
export function registerCustomDirective(tagName, handler, attributeName = 'config') {
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
export function unregisterCustomDirective(tagName) {
    return customDirectiveRegistry.delete(tagName.toLowerCase());
}
/**
 * پاکسازی کل registry (فقط برای تست‌ها و teardown کامل).
 */
export function clearCustomDirectives() {
    customDirectiveRegistry.clear();
}
/**
 * دریافت handler یک custom directive (برای دیباگ و DevTools).
 */
export function getCustomDirective(tagName) {
    return customDirectiveRegistry.get(tagName.toLowerCase())?.handler;
}
// ─────────────────────────────────────────────────────────────
// FEATURE (v0.4.0): DevTools Dependency Graph integration (zero-cost when disabled)
// ─────────────────────────────────────────────────────────────
const __elIdMap = new WeakMap();
let __elIdCounter = 0;
function __devtools() {
    return typeof window !== 'undefined' ? window.__ZENITH__ : null;
}
function __elId(el) {
    let id = __elIdMap.get(el);
    if (id === undefined) {
        id = ++__elIdCounter;
        __elIdMap.set(el, id);
    }
    return id;
}
function __trackDirective(el, directiveType, expression) {
    const dt = __devtools();
    if (!dt || typeof dt.addDirective !== 'function')
        return;
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
        const refs = expression.match(/\$([a-zA-Z_]\w*)/g) || [];
        const seen = new Set();
        for (const ref of refs) {
            const sigName = ref.slice(1);
            if (seen.has(sigName))
                continue;
            seen.add(sigName);
            dt.addSignal(sigName, sigName, undefined);
            dt.recordRead(sigName, effectId);
        }
    }
    catch (_a) {
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
export function processDOM(root, state) {
    const context = createContext(state);
    const disposes = [];
    walk(root, context, state, disposes);
    // ذخیره‌ی disposes روی root برای استفاده‌های بعدی
    // (مثلاً HMR در DevTools یا teardown کامل اپ)
    root.__zenithDisposes = disposes;
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
 */
export function walkAndBind(root, state) {
    const context = createContext(state);
    const disposes = [];
    walk(root, context, state, disposes);
    // FEATURE (v0.4.0): بازگرداندن یک تابع teardown واحد که همه‌ی disposes را
    // فراخوانی می‌کند. این تابع توسط zen-for compiler-generated کد در زمان
    // removal یک آیتم فراخوانی می‌شود تا Effectهای فرزندان clone پاکسازی شوند.
    return () => {
        for (const dispose of disposes) {
            try {
                dispose();
            }
            catch (err) {
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
function walk(node, context, state, disposes) {
    // فقط Element Nodes قابل process هستند.
    // Text Nodes و Comment Nodes نادیده گرفته می‌شوند.
    if (node.nodeType !== Node.ELEMENT_NODE)
        return;
    const el = node;
    // ── ۰. zen-virtual (FEATURE v1.2.0): virtual scrolling ──
    // zen-virtual باید قبل از zen-for چک شود چون معمولاً با zen-for روی همان
    // عنصر ترکیب می‌شود.
    if (el.hasAttribute('zen-virtual')) {
        const virtualExpr = el.getAttribute('zen-virtual');
        const forExpr = el.getAttribute('zen-for') || virtualExpr;
        const processChildren = (newNode, localContext, itemDisposes) => {
            processNodeDirectives(newNode, localContext, state, itemDisposes);
            for (const child of Array.from(newNode.children)) {
                walk(child, localContext, state, itemDisposes);
            }
        };
        disposes.push(processVirtualRepeat(el, forExpr, context, processChildren));
        return;
    }
    // ── ۱. zen-for: رندر لیست ──
    // zen-for باید قبل از همه‌ی دایرکتیوهای دیگر چک شود چون:
    //   1) کل عنصر (و فرزندانش) را با چندین clone جایگزین می‌کند.
    //   2) نباید walker معمول روی فرزندان template اجرا شود.
    //   3) می‌تواند با zen-if ترکیب نشود (هر عنصر فقط یک structural directive).
    if (el.hasAttribute('zen-for')) {
        const forExpr = el.getAttribute('zen-for');
        // processChildren callback: وقتی یک آیتم جدید ساخته می‌شود، فراخوانی می‌شود.
        // این callback باید فرزندان نود تازه‌ساخته‌شده را با context محلی walk کند
        // و disposes آن‌ها را در آرایه‌ی اختصاصی همان آیتم جمع کند.
        //
        // نکته: خود نود آیتم (مثل <li>) هم باید walk شود چون ممکن است روی خودش
        // دایرکتیوهایی مثل zen-bind:class یا zen-text داشته باشد. اما چون فرزندان
        // نود آیتم در walker معمول بررسی می‌شوند، کافی است خود نود و سپس فرزندانش
        // walk شوند.
        const processChildren = (newNode, localContext, itemDisposes) => {
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
        const expr = el.getAttribute('zen-if');
        // IMPROVEMENT-05 (v1.0.1): بررسی zen-else-if و zen-else
        const nextSibling = el.nextElementSibling;
        const hasElseChain = nextSibling && (
            nextSibling.hasAttribute('zen-else-if') || nextSibling.hasAttribute('zen-else')
        );
        if (hasElseChain) {
            // پردازش زنجیره if-else-if-else
            const chain = [{ el, expr }];
            let next = nextSibling;
            while (next) {
                if (next.hasAttribute('zen-else-if')) {
                    chain.push({ el: next, expr: next.getAttribute('zen-else-if') });
                    next = next.nextElementSibling;
                } else if (next.hasAttribute('zen-else')) {
                    chain.push({ el: next, expr: null });
                    break;
                } else { break; }
            }
            // mark siblings as handled
            for (let i = 1; i < chain.length; i++) {
                chain[i].el.setAttribute('data-zenith-else-handled', 'true');
            }
            // compile expressions (one-time)
            const evalFns = chain.map(c => c.expr ? compileExpression(c.expr) : () => true);
            // FIX (v1.2.8): P0-1 — processIfChain: rewrite to use mount/unmount
            // with comment placeholders instead of toggling style.display.
            // Previously inactive branches stayed in the DOM with their
            // effects/listeners still live (the exact bug processIf exists to
            // prevent). Now each branch element is replaced with a Comment
            // placeholder; only the active branch is mounted (inserted before
            // its placeholder and walked) and switching branches disposes the
            // previous branch's child effects and removes it from the DOM.
            const placeholders = [];
            const parents = [];
            for (const c of chain) {
                const parent = c.el.parentElement;
                parents.push(parent);
                const ph = document.createComment('zen-if-chain');
                placeholders.push(ph);
                if (parent) { parent.replaceChild(ph, c.el); }
            }
            const branchDisposes = chain.map(() => []);
            function mountBranch(i) {
                const c = chain[i];
                const ph = placeholders[i];
                const parent = parents[i];
                if (!parent) return;
                parent.insertBefore(c.el, ph);
                c.el.removeAttribute('zen-if');
                c.el.removeAttribute('zen-else-if');
                c.el.removeAttribute('zen-else');
                c.el.removeAttribute('data-zenith-else-handled');
                const ds = [];
                walk(c.el, context, state, ds);
                branchDisposes[i] = ds;
            }
            function unmountBranch(i) {
                const c = chain[i];
                const parent = parents[i];
                const ds = branchDisposes[i];
                for (const d of ds) {
                    try { d(); } catch { /* one dispose failure shouldn't block others */ }
                }
                branchDisposes[i] = [];
                if (parent && c.el.parentNode === parent) {
                    parent.removeChild(c.el);
                }
            }
            let activeIndex = -1;
            const chainDispose = effect(() => {
                let newIndex = -1;
                for (let i = 0; i < chain.length; i++) {
                    try {
                        if (Boolean(evalFns[i](context))) {
                            newIndex = i;
                            break;
                        }
                    } catch { /* expression error → treat as false */ }
                }
                if (newIndex === activeIndex) return;
                if (activeIndex !== -1) { unmountBranch(activeIndex); }
                if (newIndex !== -1) { mountBranch(newIndex); }
                activeIndex = newIndex;
            });
            disposes.push(() => {
                chainDispose();
                if (activeIndex !== -1) {
                    unmountBranch(activeIndex);
                    activeIndex = -1;
                }
                for (let i = 0; i < placeholders.length; i++) {
                    const ph = placeholders[i];
                    const parent = parents[i];
                    if (parent && ph.parentNode === parent) {
                        parent.removeChild(ph);
                    }
                }
            });
            // FIX (v1.2.8): P0-1 — do NOT walk chain elements here. They have
            // been replaced with placeholders; mountBranch will walk the active
            // branch when its condition becomes true.
            return;
        }
        const manageChildren = () => {
            const childDisposes = [];
            walk(el, context, state, childDisposes);
            return childDisposes;
        };
        disposes.push(processIf(el, expr, context, manageChildren));
        return;
    }
    // IMPROVEMENT-05 (v1.0.1): skip handled else elements
    if (el.hasAttribute('data-zenith-else-handled')) {
        el.removeAttribute('data-zenith-else-handled');
        // FIX (v1.2.8): P0-1 — handled by processIfChain (replaced with
        // placeholder; not in DOM). Do not walk children here — mountBranch
        // inside processIfChain will walk the active branch's children.
        return;
    }
    if (el.hasAttribute('zen-else') || el.hasAttribute('zen-else-if')) {
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
        processComponent(el, context, 
        // processChildren callback:
        // برای هر فرزند، walk را با Context مناسب فراخوانی می‌کند.
        // - isSlotContent=true → parentContext (محل استفاده)
        // - isSlotContent=false → localContext (داخل قالب کامپوننت)
        (childNode, childContext, childDisposes, _isSlotContent) => {
            walk(childNode, childContext, state, childDisposes);
        }, disposes);
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
        processRouter(el, 
        // processChildren callback:
        // وقتی HTML جدید لود شد، فرزندان آن را با context والد walk می‌کند.
        // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
        // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
        (childNode, childDisposes) => {
            walk(childNode, context, state, childDisposes);
        }, disposes);
        return;
    }
    // ── ۴a. FEATURE (v1.0.0): zen-suspense ──
    if (el.tagName.toLowerCase() === 'zen-suspense') {
        processSuspense(el, (childNode, childContext, childDisposes) => {
            walk(childNode, childContext, state, childDisposes);
        }, context, disposes);
        return;
    }
    // ── ۴a-bis. BUG-1 FIX (v1.2.2): zen-error — Error Boundary محلی ──
    // قبلاً این dispatch پیاده‌سازی نشده بود و zen-error یک attribute مرده بود.
    if (el.hasAttribute('zen-error')) {
        processErrorBoundary(el, (childNode, childDisposes) => {
            walk(childNode, context, state, childDisposes);
        }, disposes);
        return;
    }
    // ── ۴a-ter. FEATURE (v1.2.0): zen-memo — Memoized subtree ──
    if (el.hasAttribute('zen-memo')) {
        const memoExpr = el.getAttribute('zen-memo');
        disposes.push(processMemo(el, memoExpr, context, (nodeEl, nodeCtx, nodeDisposes) => {
            processNodeDirectives(nodeEl, nodeCtx, state, nodeDisposes);
            for (const child of Array.from(nodeEl.children)) {
                walk(child, nodeCtx, state, nodeDisposes);
            }
        }));
        return;
    }
    // ── ۴a-quart. FEATURE (v1.2.0): zen-date-picker — Persian date picker ──
    if (el.tagName.toLowerCase() === 'zen-date-picker') {
        disposes.push(processDatePicker(el, context));
    }
    // ── ۴a-quint. FEATURE (v1.2.0): zen-island — Deferred hydration ──
    if (el.hasAttribute('zen-island')) {
        const hydrateMode = el.getAttribute('zen-island') || 'load';
        disposes.push(processIsland(el, hydrateMode, context, (nodeEl, nodeCtx, nodeDisposes) => {
            processNodeDirectives(nodeEl, nodeCtx, state, nodeDisposes);
            for (const child of Array.from(nodeEl.children)) {
                walk(child, nodeCtx, state, nodeDisposes);
            }
        }));
        return;
    }
    // ── ۴a-sext. FEATURE (v1.2.0): zen-button — Stateful button ──
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
        const resourceExpr = el.getAttribute('zen-resource');
        processResource(el, resourceExpr, context, (childNode, childContext, childDisposes) => { walk(childNode, childContext, state, childDisposes); }, disposes);
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
        const fetchExpr = el.getAttribute('zen-fetch');
        processFetch(el, fetchExpr, context, 
        // processChildren callback:
        // فرزندان با Context محلی (شامل $<stateName>) walk می‌شوند.
        // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
        // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
        (childNode, childContext, childDisposes) => {
            walk(childNode, childContext, state, childDisposes);
        }, disposes);
        return;
    }
    // ── ۶. دایرکتیوهای معمول روی این نود ──
    // ── zen-show (visibility toggle without DOM removal) ──
    if (el.hasAttribute('zen-show')) {
        const showExpr = el.getAttribute('zen-show');
        disposes.push(processShow(el, showExpr, context));
        // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
        __trackDirective(el, 'show', showExpr);
    }
    // ── zen-animate (FEATURE v0.5.0): انیمیشن مبتنی بر Web Animations API ──
    // این دایرکتیو یک‌بار روی mount اجرا می‌شود و یک keyframe animation را روی
    // عنصر با el.animate() اجرا می‌کند. تابع processAnimate یک no-op dispose
    // برمی‌گرداند چون انیمیشن خودش را پس از پایان با anim.cancel() پاک می‌کند.
    if (el.hasAttribute('zen-animate')) {
        const animateAttr = el.getAttribute('zen-animate');
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
function processNodeDirectives(el, context, state, disposes) {
    // ── zen-html-trusted / zen-html / zen-text (فاز ۹ + v0.4.0: فقط یکی از آنها) ──
    // یک عنصر نمی‌تواند همزمان چند دایرکتیو text/html داشته باشد.
    // اولویت: zen-html-trusted > zen-html > zen-text.
    //   - zen-html-trusted: توسعه‌دهنده صراحتاً opt-in کرده که محتوا Trusted است.
    //     اگر این وجود داشت، override می‌کند چون عمدی‌ترین انتخاب است.
    //   - zen-html:         همیشه sanitize می‌شود.
    //   - zen-text:         متن ساده، امن.
    // FEATURE (v0.4.0): zen-html-trusted registered in walker dispatch.
    if (el.hasAttribute('zen-html-trusted')) {
        const expr = el.getAttribute('zen-html-trusted');
        disposes.push(processHtmlTrusted(el, expr, context));
        // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
        __trackDirective(el, 'html-trusted', expr);
    }
    else if (el.hasAttribute('zen-html')) {
        const expr = el.getAttribute('zen-html');
        disposes.push(processHtml(el, expr, context));
        // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
        __trackDirective(el, 'html', expr);
    }
    else if (el.hasAttribute('zen-text')) {
        const expr = el.getAttribute('zen-text');
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
        const expr = el.getAttribute('zen-model');
        disposes.push(processModel(el, expr, context, state));
        // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
        __trackDirective(el, 'model', expr);
    }
    // ─────────────────────────────────────────────────────────────
    // FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
    // ─────────────────────────────────────────────────────────────
    // ── zen-portal: جابجایی عنصر به container دیگر ──
    // dispose: عنصر را به محل اصلی‌اش برمی‌گرداند.
    if (el.hasAttribute('zen-portal')) {
        const targetSelector = el.getAttribute('zen-portal');
        disposes.push(processPortal(el, targetSelector, context));
        __trackDirective(el, 'portal', targetSelector);
    }
    // ── zen-intersection: lazy-load با IntersectionObserver ──
    // dispose: observer.disconnect(). SSR-safe (no-op اگر IntersectionObserver نباشد).
    if (el.hasAttribute('zen-intersection')) {
        const callbackExpr = el.getAttribute('zen-intersection');
        disposes.push(processIntersection(el, callbackExpr, context));
        __trackDirective(el, 'intersection', callbackExpr);
    }
    // ── zen-ref: bind عنصر DOM به یک Signal در state ──
    // dispose: signal.set(null) برای جلوگیری از memory leak.
    if (el.hasAttribute('zen-ref')) {
        const refName = el.getAttribute('zen-ref');
        // نکته: state پاس داده می‌شود چون Signalها در state ذخیره می‌شوند
        // (در context فقط getterهای آنها دیده می‌شود، نه خود Signal).
        disposes.push(processRef(el, refName, state));
        __trackDirective(el, 'ref', refName);
    }
    // ── zen-cloak: حذف attribute برای visible شدن عنصر (ضد FOUC) ──
    // باید **آخرین** دایرکتیو باشد تا flicker نباشد.
    if (el.hasAttribute('zen-cloak')) {
        disposes.push(processCloak(el));
        __trackDirective(el, 'cloak', '');
    }
    // ─────────────────────────────────────────────────────────────
    // FEATURE (v1.2.0): v1.2.x non-structural directives.
    // ─────────────────────────────────────────────────────────────
    // ── zen-optimistic: optimistic update with rollback ──
    if (el.hasAttribute('zen-optimistic')) {
        const optimisticExpr = el.getAttribute('zen-optimistic');
        const rollbackExpr = el.getAttribute('data-rollback');
        disposes.push(processOptimistic(el, optimisticExpr, rollbackExpr, context, state));
        __trackDirective(el, 'optimistic', optimisticExpr);
    }
    // ── zen-track: analytics tracking ──
    if (el.hasAttribute('zen-track')) {
        const trackAttr = el.getAttribute('zen-track');
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
function walkChildren(el, context, state, disposes) {
    // Array.from برای جلوگیری از تغییر Collection در حین iteration
    // (مثلاً وقتی zen-if یک عنصر را اضافه/حذف می‌کند)
    for (const child of Array.from(el.children)) {
        walk(child, context, state, disposes);
    }
}
//# sourceMappingURL=walker.js.map