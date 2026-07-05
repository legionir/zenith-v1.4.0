// packages/ssr/src/hydrate.ts
//
// Real Hydration — Phase 6.
//
// تفاوت با startFromSSR: این تابع DOM موجود را adopt می‌کند به‌جای
// بازسازی. برای هر عنصر با zen-* attribute، Effect را به عنصر موجود
// متصل می‌کند بدون innerHTML rewrite.
//
// ── نحوه کار ──
//
// 1. State از window.__ZENITH_STATE__ خوانده می‌شود.
// 2. Zen.start صدا زده می‌شود — اما walker عناصر موجود را پیدا می‌کند.
// 3. برای zen-text: textContent موجود بررسی می‌شود و فقط اگر متفاوت است آپدیت می‌شود.
// 4. برای zen-if: اگر عنصر در DOM است، isMounted=true فرض می‌شود.
// 5. برای zen-for: آیتم‌های موجود adopt می‌شوند.
//
// نتیجه: no flicker، no re-render، فقط Effect attach.
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
/**
 * Deserialize state.
 *
 * BUG FIX (BUG-09): این تابع حالا قبل از iteration، type validation انجام
 * می‌دهد تا از prototype pollution و خطاهای runtime جلوگیری شود.
 */
export function deserializeState(serializedState) {
    const state = {};
    // ── Type Validation ──
    if (typeof serializedState !== 'object' || serializedState === null || Array.isArray(serializedState)) {
        console.error('[Zenith hydrate] __ZENITH_STATE__ must be a plain object');
        return state;
    }
    for (const key in serializedState) {
        // ── Prototype Pollution Protection ──
        if (!Object.prototype.hasOwnProperty.call(serializedState, key)) continue;
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        state[key] = signal(serializedState[key]);
    }
    return state;
}
/**
 * Hydrate: DOM موجود را به Effectها متصل می‌کند.
 *
 * این تابع فرض می‌کند که HTML از سرور آمده و در DOM موجود است.
 * Zen.start صدا زده می‌شود اما walker به‌جای بازسازی، عناصر موجود را
 * process می‌کند. چون walker قبلاً عناصر را با attribute‌های zen-* پیدا
 * می‌کند و Effect می‌سازد، این کار به‌طور طبیعی "adopt" می‌کند:
 *
 * - zen-text: Effect ساخته می‌شود، textContent اولین بار با مقدار فعلی
 *   set می‌شود (که همان مقدار SSR است) → no visible change.
 * - zen-if: اگر عنصر در DOM است و condition true است → no change.
 *   اگر condition false است → عنصر حذف می‌شود.
 * - zen-for: Effect ساخته می‌شود، اما چون data از state می‌آید (که از
 *   SSR آمده)، آیتم‌های موجود تطابق دارند → no rebuild.
 *
 * نکته: این "true hydration" نیست (در معنی React/Svelte) چون Effectها
 * از نو ساخته می‌شوند. اما از نظر visible behavior، no flicker رخ می‌دهد
 * چون مقادیر اولیه یکسان هستند.
 *
 * @param root     عنصر root.
 * @param initFn   تابع init برای ثبت actions.
 */
export async function hydrate(root, initFn) {
    const startTime = performance.now();
    try {
        const serializedState = window.__ZENITH_STATE__;
        if (!serializedState) {
            return {
                success: false,
                elementsAdopted: 0,
                duration: 0,
                error: 'No __ZENITH_STATE__ found. Use Zen.start() instead.',
            };
        }
        const state = deserializeState(serializedState);
        // Set route if available.
        const initialRoute = window.__ZENITH_ROUTE__;
        if (initialRoute && initialRoute !== 'null') {
            try {
                const { routeSignal } = await import('@zenith/router');
                routeSignal.set({ path: initialRoute, params: {} });
            }
            catch { /* router not available */ }
        }
        // User init: register actions, etc.
        if (initFn)
            initFn(state);
        // Count elements before hydration.
        const elementsBefore = root.querySelectorAll('[zen-text], [zen-if], [zen-for], [zen-bind], [zen-model], [zen-html], [zen-action], [zen-fetch]').length;
        // FEATURE (v0.4.0): skip server-component subtrees.
        // قبل از Zen.start، تمام attributeهای zen-* را از عناصر داخل
        // مناطق server-component حذف می‌کنیم. این کار باعث می‌شود walker
        // وارد آن مناطق نشود و Effect برایشان نسازد → no client JS.
        //
        // مناطق server-component با commentهای زیر مشخص می‌شوند:
        //   <!--zenith-server-component:NAME-->...<!--/zenith-server-component:NAME-->
        const serverComponentsSkipped = skipServerComponents(root);
        // Start Zen — walker عناصر موجود را process می‌کند.
        // چون state مقادیر SSR را دارد، Effectها همان مقادیر را set می‌کنند
        // که قبلاً در DOM هستند → no visible change.
        const { Zen } = await import('@zenith/runtime');
        Zen.start(root, state);
        flushSync();
        const duration = performance.now() - startTime;
        return {
            success: true,
            elementsAdopted: elementsBefore,
            duration,
            serverComponentsSkipped,
        };
    }
    catch (err) {
        return {
            success: false,
            elementsAdopted: 0,
            duration: performance.now() - startTime,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * @deprecated از hydrate استفاده کنید.
 */
export async function startFromSSR(root, initFn) {
    return hydrate(root, initFn);
}
export function isHydrationMode() {
    return typeof window !== 'undefined' && !!window.__ZENITH_STATE__;
}
export function clearHydrationData() {
    if (typeof window !== 'undefined') {
        delete window.__ZENITH_STATE__;
        delete window.__ZENITH_ROUTE__;
    }
}
// ── FEATURE (v0.4.0): Server Component skip ──
/**
 * پیشوندهای markerهای Server Component.
 *
 * این مقادیر باید با آنچه در `server-component.ts` تعریف شده هماهنگ باشند.
 */
const SC_OPEN_PREFIX = 'zenith-server-component:';
const SC_CLOSE_PREFIX = '/zenith-server-component:';
/**
 * تمام attributeهای zen-* را از عناصر داخل مناطق server-component حذف
 * می‌کند تا runtime walker وارد آن‌ها نشود.
 *
 * مناطق server-component با commentهای زیر محصور شده‌اند:
 *   <!--zenith-server-component:NAME-->...<!--/zenith-server-component:NAME-->
 *
 * نحوه کار:
 *   1. تمام comment nodeها در root را پیمایش می‌کنیم.
 *   2. commentهای بازشونده و بست‌شونده را با هم جفت می‌کنیم (بر اساس name).
 *   3. برای هر جفت، تمام elementها بین آن‌ها را پیدا کرده و تمام attributeهای
 *      zen-* را از آن‌ها (و فرزندانشان) حذف می‌کنیم.
 *
 * SSR-Safe: این تابع فقط در کلاینت (هنگام hydrate) اجرا می‌شود و هیچ
 * ارجاعی به globals سرور ندارد.
 *
 * @param root عنصر ریشه.
 * @returns تعداد کل attributeهای zen-* که حذف شده‌اند.
 */
function skipServerComponents(root) {
    // اگر document در دسترس نیست (مثلاً SSR context)، no-op.
    if (typeof document === 'undefined' || !document.createTreeWalker) {
        return 0;
    }
    // جمع‌آوری تمام commentهای server-component به ترتیب document.
    const commentWalker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const comments = [];
    let node;
    while ((node = commentWalker.nextNode()) !== null) {
        const text = node.data || '';
        if (text.startsWith(SC_OPEN_PREFIX) || text.startsWith(SC_CLOSE_PREFIX)) {
            comments.push(node);
        }
    }
    if (comments.length === 0)
        return 0;
    // جفت‌کردن open/close. comments به ترتیب document هستند، پس هر open
    // با اولین close هم‌نام بعد از خودش جفت می‌شود.
    let stripped = 0;
    const usedClose = new Set();
    for (let i = 0; i < comments.length; i++) {
        const open = comments[i];
        const openText = open.data || '';
        if (!openText.startsWith(SC_OPEN_PREFIX))
            continue;
        const name = openText.slice(SC_OPEN_PREFIX.length).trim();
        // پیدا کردن close متناظر.
        let close = null;
        for (let j = i + 1; j < comments.length; j++) {
            const c = comments[j];
            if (usedClose.has(c))
                continue;
            const ct = c.data || '';
            if (ct.startsWith(SC_CLOSE_PREFIX)) {
                const closeName = ct.slice(SC_CLOSE_PREFIX.length).trim();
                // اگر name در close ذکر شده، باید تطابق کند.
                // اگر name در close ذکر نشده (close خالی)، اولین close را قبول کن.
                if (closeName === '' || closeName === name) {
                    close = c;
                    usedClose.add(c);
                    break;
                }
            }
        }
        if (!close)
            continue;
        // Strip zen-* attributeها از تمام elementهای بین open و close.
        let current = open.nextSibling;
        while (current && current !== close) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                stripped += stripZenAttributes(current);
            }
            current = current.nextSibling;
        }
    }
    return stripped;
}
/**
 * بازگشتی تمام attributeهای zen-* را از یک element و فرزندانش حذف می‌کند.
 *
 * @returns تعداد attributeهای حذف‌شده.
 */
function stripZenAttributes(el) {
    let count = 0;
    // Array.from برای جلوگیری از تغییر collection در حین iteration.
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
        if (attr.name.startsWith('zen-')) {
            el.removeAttribute(attr.name);
            count++;
        }
    }
    // فرزندان را هم بازگشتی پاک کن.
    for (const child of Array.from(el.children)) {
        count += stripZenAttributes(child);
    }
    return count;
}
//# sourceMappingURL=hydrate.js.map