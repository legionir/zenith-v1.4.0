// packages/virtual-list/src/virtual-list.ts
//
// @zenith/virtual-list — Virtual Scrolling (Phase 5 Critical).
//
// فقط visible rows را render می‌کند (10-20 آیتم به‌جای 10000).
// از Intersection Observer و scroll position برای محاسبه visible range استفاده می‌کند.
//
// ── سینتکس ──
//   <div zen-virtual-list="$items" zen-key="item.id" zen-item-height="40" zen-buffer="5">
//     <span zen-text="$item.name"></span>
//   </div>
//
// - zen-virtual-list: Expression آرایه
// - zen-key: Expression کلید (مثل item.id)
// - zen-item-height: ارتفاع هر آیتم به پیکسل (پیش‌فرض: 40)
//                    ⚠️ اگر zen-dynamic-heights="true" باشد، این مقدار به‌عنوان
//                    ارتفاع تخمینی اولیه استفاده می‌شود.
// - zen-buffer: تعداد آیتم‌های اضافی قبل/بعد visible area (پیش‌فرض: 5)
// - zen-dynamic-heights: "true" برای فعال‌سازی ارتفاع متغیر (پیش‌فرض: "false")
//
// ── Dynamic Heights (Production Readiness #31) ──
//
//   وقتی zen-dynamic-heights="true" فعال باشد:
//     - ارتفاع هر آیتم توسط ResizeObserver اندازه‌گیری می‌شود.
//     - مکان هر آیتم بر اساس مجموع ارتفاع آیتم‌های قبلی محاسبه می‌شود
//       (prefix sum) نه ضرب index در itemHeight.
//     -spacer height به‌جای total * itemHeight، مجموع ارتفاع همه‌ی آیتم‌های
//       شناخته‌شده + تخمین برای آیتم‌های رندر‌نشده است.
//     - زمانی که آیتم جدیدی رندر می‌شود، ResizeObserver اندازه‌ی واقعی آن را
//       ثبت می‌کند و آیتم‌های بعدی به‌طور خودکار shift می‌شوند.
//
//   این قابلیت برای لیست‌هایی با محتوای heterogeneous (مثلاً چت با پیام‌های
//   با طول متفاوت) ضروری است.
import { signal, effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
export function processVirtualList(el, listExpr, context, processChildren, disposes) {
    const config = {
        itemHeight: parseInt(el.getAttribute('zen-item-height') || '40', 10),
        buffer: parseInt(el.getAttribute('zen-buffer') || '5', 10),
        dynamicHeights: el.getAttribute('zen-dynamic-heights') === 'true',
    };
    // Container setup
    el.style.overflowY = 'auto';
    el.style.position = 'relative';
    el.style.contain = 'strict';
    // Spacer برای ایجاد scroll height صحیح
    const spacer = document.createElement('div');
    spacer.style.position = 'absolute';
    spacer.style.top = '0';
    spacer.style.left = '0';
    spacer.style.right = '0';
    spacer.style.pointerEvents = 'none';
    el.appendChild(spacer);
    // Content container برای visible items
    const content = document.createElement('div');
    content.style.position = 'relative';
    el.appendChild(content);
    // State: visible range
    const rangeSignal = signal({ start: 0, end: 0 });
    // State: visible items (clone of template)
    const renderedNodes = new Map();
    // ── Dynamic Heights State ──
    // heights[i] = ارتفاع واقعی آیتم i (در حالت dynamic)
    // در حالت ثابت، این Map خالی می‌ماند و itemHeight استفاده می‌شود.
    const heights = new Map();
    // offsets[i] = موقعیت y آیتم i (در حالت dynamic)
    // این cache برای جستجوی سریع binary search به‌کار می‌آید.
    let offsetsCache = [];
    let totalHeightCache = 0;
    // Template: اولین فرزند el به‌عنوان template استفاده می‌شود
    const templateEl = el.querySelector(':scope > template:not([slot])');
    let templateContent;
    // IMPROVEMENT-03 (v1.0.1): empty و loading slots
    const emptySlot = el.querySelector(':scope > template[slot="empty"]');
    const loadingSlot = el.querySelector(':scope > template[slot="loading"]');
    if (emptySlot) emptySlot.remove();
    if (loadingSlot) loadingSlot.remove();
    let emptyNode = null;
    let loadingNode = null;
    if (templateEl) {
        templateContent = templateEl.content;
        templateEl.remove();
    }
    else {
        const firstChild = el.firstElementChild;
        if (firstChild && firstChild !== spacer && firstChild !== content) {
            const tpl = document.createElement('template');
            tpl.content.appendChild(firstChild.cloneNode(true));
            templateContent = tpl.content;
            firstChild.remove();
        }
        else {
            console.error('[zen-virtual-list] No template or child element found');
            return;
        }
    }
    let currentList = [];
    let scrollRaf = null;
    // Scroll handler
    const onScroll = () => {
        if (scrollRaf !== null)
            return;
        scrollRaf = requestAnimationFrame(() => {
            scrollRaf = null;
            updateRange();
        });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Resize handler
    let resizeRaf = null;
    const resizeObserver = new ResizeObserver(() => {
        if (resizeRaf !== null)
            return;
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            updateRange();
        });
    });
    resizeObserver.observe(el);
    // ── Dynamic Heights: per-item ResizeObserver ──
    // این observer فقط در حالت dynamic فعال می‌شود.
    // وقتی آیتمی resize می‌شود، ارتفاع آن را در heights ثبت می‌کنیم
    // و offsets را بازمحاسبه می‌کنیم.
    let itemResizeRaf = null;
    let pendingItemResizes = new Set();
    const itemResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const idx = entry.target.dataset.zenVlistIdx;
            if (idx == null)
                continue;
            const i = parseInt(idx, 10);
            const newHeight = entry.contentRect.height;
            const oldHeight = heights.get(i);
            if (oldHeight !== newHeight) {
                heights.set(i, newHeight);
                pendingItemResizes.add(i);
            }
        }
        // تجمیع بازمحاسبه‌ها در یک RAF
        if (itemResizeRaf !== null)
            return;
        itemResizeRaf = requestAnimationFrame(() => {
            itemResizeRaf = null;
            if (pendingItemResizes.size > 0) {
                pendingItemResizes.clear();
                // بازمحاسبه offsets و re-render
                recomputeOffsets();
                updateRange();
            }
        });
    });
    /**
     * بازمحاسبه‌ی offsets و totalHeight بر اساس heights شناخته‌شده.
     * برای آیتم‌های ناشناخته، از itemHeight پیش‌فرض استفاده می‌شود.
     */
    function recomputeOffsets() {
        if (!config.dynamicHeights) {
            // در حالت ثابت، نیازی به cache نیست
            offsetsCache = [];
            totalHeightCache = currentList.length * config.itemHeight;
            return;
        }
        offsetsCache = new Array(currentList.length);
        let acc = 0;
        for (let i = 0; i < currentList.length; i++) {
            offsetsCache[i] = acc;
            const h = heights.get(i);
            acc += h !== undefined ? h : config.itemHeight;
        }
        totalHeightCache = acc;
    }
    /**
     * یافتن index آیتمی که در offset مشخص قرار دارد (binary search).
     * فقط در حالت dynamic استفاده می‌شود.
     */
    function findItemAtOffset(scrollTop) {
        if (offsetsCache.length === 0)
            return 0;
        // binary search
        let lo = 0;
        let hi = offsetsCache.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const midEnd = mid + 1 < offsetsCache.length
                ? offsetsCache[mid + 1]
                : totalHeightCache;
            if (scrollTop < offsetsCache[mid]) {
                hi = mid - 1;
            }
            else if (scrollTop >= midEnd) {
                lo = mid + 1;
            }
            else {
                return mid;
            }
        }
        return Math.max(0, Math.min(lo, offsetsCache.length - 1));
    }
    /**
     * دریافت ارتفاع یک آیتم (با fallback به itemHeight).
     */
    function getHeight(i) {
        if (!config.dynamicHeights)
            return config.itemHeight;
        const h = heights.get(i);
        return h !== undefined ? h : config.itemHeight;
    }
    /**
     * دریافت offset (موقعیت y) یک آیتم.
     */
    function getOffset(i) {
        if (!config.dynamicHeights)
            return i * config.itemHeight;
        if (i < offsetsCache.length)
            return offsetsCache[i];
        // fallback برای آیتم‌های خارج از cache
        return i * config.itemHeight;
    }
    function updateRange() {
        const scrollTop = el.scrollTop;
        const viewportHeight = el.clientHeight;
        const total = currentList.length;
        let start;
        let end;
        if (config.dynamicHeights && offsetsCache.length > 0) {
            // در حالت dynamic، از binary search استفاده می‌کنیم
            start = findItemAtOffset(scrollTop);
            // به‌علاوه buffer آیتم قبل
            start = Math.max(0, start - config.buffer);
            // پیدا کردن end با شمارش آیتم‌ها تا viewport پوشش داده شود
            let acc = getOffset(start);
            end = start;
            while (end < total && acc < scrollTop + viewportHeight + config.buffer * config.itemHeight) {
                acc += getHeight(end);
                end++;
            }
            // به‌علاوه buffer بعد
            end = Math.min(total, end + config.buffer);
        }
        else {
            // حالت ثابت: محاسبه ساده
            const visibleCount = Math.ceil(viewportHeight / config.itemHeight);
            start = Math.max(0, Math.floor(scrollTop / config.itemHeight) - config.buffer);
            end = Math.min(total, start + visibleCount + config.buffer * 2);
        }
        // Update spacer height
        const totalHeight = config.dynamicHeights ? totalHeightCache : total * config.itemHeight;
        spacer.style.height = `${totalHeight}px`;
        rangeSignal.set({ start, end });
        renderVisible(start, end);
        updateEmptyState();
    }
    function updateEmptyState() {
        const shouldShowEmpty = currentList.length === 0 && emptySlot;
        const shouldShowLoading = false;
        if (shouldShowEmpty && !emptyNode) {
            emptyNode = document.createElement('div');
            emptyNode.className = 'zen-vlist-empty';
            emptyNode.style.cssText = 'padding:20px;text-align:center;';
            emptyNode.appendChild(emptySlot.content.cloneNode(true));
            el.appendChild(emptyNode);
            spacer.style.display = 'none';
            content.style.display = 'none';
        } else if (!shouldShowEmpty && emptyNode) {
            emptyNode.remove();
            emptyNode = null;
            spacer.style.display = '';
            content.style.display = '';
        }
        if (shouldShowLoading && !loadingNode && loadingSlot) {
            loadingNode = document.createElement('div');
            loadingNode.className = 'zen-vlist-loading';
            loadingNode.style.cssText = 'padding:20px;text-align:center;';
            loadingNode.appendChild(loadingSlot.content.cloneNode(true));
            el.appendChild(loadingNode);
        } else if (!shouldShowLoading && loadingNode) {
            loadingNode.remove();
            loadingNode = null;
        }
    }
    function renderVisible(start, end) {
        // Remove nodes outside range
        for (const [idx, entry] of renderedNodes) {
            if (idx < start || idx >= end) {
                itemResizeObserver.unobserve(entry.node);
                entry.node.remove();
                entry.disposes.forEach(d => { try {
                    d();
                }
                catch { } });
                renderedNodes.delete(idx);
                // در حالت dynamic، ارتفاع را نگه می‌داریم تا offsets پایدار بماند.
                // این مهم است چون اگر کاربر بالا پایین scroll کند، آیتم‌هایی که قبلاً
                // دیده شده‌اند ارتفاعشان را حفظ کنند.
            }
        }
        // Add nodes in range
        for (let i = start; i < end && i < currentList.length; i++) {
            if (renderedNodes.has(i))
                continue;
            const item = currentList[i];
            // FIX (v1.2.7): wrap cloned template content in a real <div> element
            // instead of casting DocumentFragment to HTMLElement (or extracting
            // firstElementChild, which dropped sibling template roots). The
            // div receives the positioning styles and we process its children
            // — which are the fragment's original children — with the runtime
            // walker.
            const frag = templateContent.cloneNode(true);
            const newNode = document.createElement('div');
            newNode.appendChild(frag);
            // Build context with $item and $index
            const itemSignal = signal(item);
            const indexSignal = signal(i);
            const childCtx = Object.create(context);
            Object.defineProperty(childCtx, '$item', { get: () => itemSignal.get(), enumerable: true, configurable: true });
            Object.defineProperty(childCtx, '$index', { get: () => indexSignal.get(), enumerable: true, configurable: true });
            // Bare names too
            if (!('item' in context)) {
                Object.defineProperty(childCtx, 'item', { get: () => itemSignal.get(), enumerable: true, configurable: true });
            }
            if (!('index' in context)) {
                Object.defineProperty(childCtx, 'index', { get: () => indexSignal.get(), enumerable: true, configurable: true });
            }
            // __zenith_signals__ for zen-model
            const parentSignals = context.__zenith_signals__;
            const signalsMap = parentSignals ? new Map(parentSignals) : new Map();
            signalsMap.set('item', itemSignal);
            signalsMap.set('index', indexSignal);
            Object.defineProperty(childCtx, '__zenith_signals__', { value: signalsMap, enumerable: false, configurable: true });
            // Set position on the wrapper div.
            newNode.style.position = 'absolute';
            newNode.style.top = '0';
            newNode.style.left = '0';
            newNode.style.right = '0';
            const itemH = getHeight(i);
            const itemOffset = getOffset(i);
            // در حالت dynamic، ارتفاع را fixed نمی‌گذاریم تا ResizeObserver بتواند
            // اندازه‌ی واقعی را اندازه بگیرد.
            if (!config.dynamicHeights) {
                newNode.style.height = `${itemH}px`;
            }
            newNode.style.transform = `translateY(${itemOffset}px)`;
            // dataset برای شناسایی در ResizeObserver
            newNode.dataset.zenVlistIdx = String(i);
            const itemDisposes = [];
            // FIX (v1.2.7): process the div's children (the cloned template
            // content). Each direct child is a runtime-walker root.
            for (const child of Array.from(newNode.children)) {
                processChildren(child, childCtx, itemDisposes);
            }
            content.appendChild(newNode);
            // در حالت dynamic، observer را برای این آیتم فعال کن
            if (config.dynamicHeights) {
                itemResizeObserver.observe(newNode);
            }
            renderedNodes.set(i, { node: newNode, disposes: itemDisposes });
        }
        // در حالت dynamic، offsets آیتم‌های رندر‌شده را به‌روز نگه دار
        // (ResizeObserver به‌طور خودکار کار می‌کند، اما اگر ارتفاعی از قبل معلوم است،
        // می‌توانیم offsets را برای آیتم‌های بعد از خود به‌روز کنیم.)
    }
    // FEATURE (v1.0.0): compile-once — listExpr فقط یک‌بار parse می‌شود.
    const listEvalFn = compileExpression(listExpr);
    // Effect: watch list expression
    const disposeEffect = effect(() => {
        const list = listEvalFn(context);
        const newList = Array.isArray(list) ? list : [];
        // اگر طول list تغییر کرد، heights را برای آیتم‌های حذف‌شده پاک کن
        if (newList.length < currentList.length) {
            for (const key of heights.keys()) {
                if (key >= newList.length)
                    heights.delete(key);
            }
        }
        currentList = newList;
        recomputeOffsets();
        updateRange();
    });
    disposes.push(() => {
        el.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
        itemResizeObserver.disconnect();
        if (scrollRaf !== null)
            cancelAnimationFrame(scrollRaf);
        if (resizeRaf !== null)
            cancelAnimationFrame(resizeRaf);
        if (itemResizeRaf !== null)
            cancelAnimationFrame(itemResizeRaf);
        for (const [, entry] of renderedNodes) {
            entry.disposes.forEach(d => { try {
                d();
            }
            catch { } });
        }
        renderedNodes.clear();
        disposeEffect();
    });
}
//# sourceMappingURL=virtual-list.js.map