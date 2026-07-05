// packages/runtime/src/directives/for.ts
//
// دایرکتیو zen-for: رندر لیست‌ها با Keyed Diffing و Fine-Grained Reactivity.
//
// سینتکس:
//   <li zen-for="item in $items" zen-key="item.id">...</li>
//   <li zen-for="(item, index) in $items" zen-key="item.id">...</li>
//
// ویژگی‌ها:
//   1) Keyed Diffing: اگر ترتیب آیتم‌ها تغییر کند، DOM node ها جابجا می‌شوند
//      نه نابود و دوباره ساخته شوند. این باعث حفظ focus اینپوت‌ها، انیمیشن‌ها،
//      و state داخلی می‌شود.
//   2) Fine-Grained Reactivity: برای هر آیتم یک Signal محلی (`itemSignal` و
//      `indexSignal`) ساخته می‌شود. اگر یک آیتم در آرایه تغییر کند، فقط
//      همان ردیف در DOM آپدیت می‌شود، نه کل لیست.
//   3) Memory Leak Prevention: هنگام unmount یک آیتم، تمام Effectهای فرزندانش
//      dispose می‌شوند.
//
// معماری:
//   - الگوریتم اصلی: در یک Effect اجرا می‌شود تا هر بار که آرایه تغییر می‌کند،
//     Diffing دوباره اجرا شود.
//   - داخل Effect، نباید `itemSignal.set` باعث re-trigger این Effect شود — برای
//     جلوگیری، `itemSignal` فقط در آیتم‌های تازه ساخته‌شده به Signal آرایه
//     وابسته نیست (هر آیتم Effectهای فرزندان خودش را دارد).
import { effect, signal } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { zenForNoZenKeyError, zenForInvalidSyntaxError } from '@zenith/errors';
import { enterTransition, leaveTransition, cancelTransition } from '@zenith/transition';
/**
 * پارس کردن سینتکس `zen-for`.
 *
 * سینتکس‌های پشتیبانی‌شده:
 *   "item in $items"
 *   "(item, index) in $items"
 *   "item in $items.filter(x => x.active)"
 *
 * @param expr رشته‌ی expression از attribute `zen-for`.
 */
function parseForSyntax(expr) {
    const match = expr.match(/^\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+(.+)$/);
    if (!match) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با مثال.
        throw zenForInvalidSyntaxError(expr);
    }
    return {
        itemName: match[1],
        indexName: match[2] || 'index',
        listExpr: match[3].trim(),
    };
}
/**
 * ساخت Context محلی برای یک آیتم حلقه.
 *
 * این Context:
 *   - تمام کلیدهای Context والد را به ارث می‌برد (با prototype chain).
 *   - چهار کلید جدید اضافه می‌کند:
 *       $<itemName>  و  <itemName>      → هر دو به itemSignal اشاره می‌کنند
 *       $<indexName> و  <indexName>     → هر دو به indexSignal اشاره می‌کنند
 *
 * چرا هم با `$` و هم بدون `$`؟
 *   - برای سازگاری با Context اصلی که از State ساخته می‌شود (جایی که
 *     `state.user` به `$user` تبدیل می‌شود)، نسخه‌ی `$` ضروری است.
 *   - اما برای راحتی کاربر در HTML، می‌خواهیم `zen-for="item in $items"`
 *     و `zen-text="item.name"` هم کار کند (بدون نیاز به `$item`).
 *   - پس هر دو سینتکس را پشتیبانی می‌کنیم.
 *
 * نکته: getter ها باعث می‌شوند وقتی Expression Engine به `$item` یا `item`
 * دسترسی پیدا می‌کند، Signal.get() فراخوانی شود و dependency tracking فعال شود.
 *
 * چرا Object.create به جای spread؟
 *   - spread ({ ...parent }) مقادیر فعلی را کپی می‌کند، نه getter ها را.
 *   - Object.create(parent) یک prototype chain می‌سازد که getter های والد
 *     همچنان فعال می‌مانند (مثل getter های `$user` که Signal.get می‌زنند).
 */
function createLoopContext(parentContext, itemName, indexName, itemSignal, indexSignal) {
    // یک آبجکت جدید با prototype = parentContext.
    // به این ترتیب تمام کلیدهای والد (از جمله getter های `$user` و غیره)
    // به ارث می‌رسند و هنوز reactive می‌مانند.
    const child = Object.create(parentContext);
    // تعریف getter برای `$item` و `item` (هر دو به itemSignal).
    // این getter ها Signal.get() را فراخوانی می‌کنند تا dependency tracking
    // فعال شود.
    const itemKey = `$${itemName}`;
    const itemKeyBare = itemName;
    Object.defineProperty(child, itemKey, {
        get: () => itemSignal.get(),
        enumerable: true,
        configurable: true,
    });
    // فقط اگر نام bare با چیزی در parent تداخل نداشت (جلوگیری از override
    // متغیرهای والد). در حالت عادی، parent context فقط `$xxx` دارد، پس
    // `item` و `index` آزاد هستند.
    if (!(itemKeyBare in parentContext)) {
        Object.defineProperty(child, itemKeyBare, {
            get: () => itemSignal.get(),
            enumerable: true,
            configurable: true,
        });
    }
    // تعریف getter برای `$index` و `index`.
    const indexKey = `$${indexName}`;
    const indexKeyBare = indexName;
    Object.defineProperty(child, indexKey, {
        get: () => indexSignal.get(),
        enumerable: true,
        configurable: true,
    });
    if (!(indexKeyBare in parentContext)) {
        Object.defineProperty(child, indexKeyBare, {
            get: () => indexSignal.get(),
            enumerable: true,
            configurable: true,
        });
    }
    // ── ثبت reference به Signal های محلی (برای zen-model) ──
    // این کار به zen-model اجازه می‌دهد در داخل zen-for، Signal محلی item
    // را پیدا کرده و set کند. بدون این، zen-model روی متغیرهای محلی کار نمی‌کند.
    //
    // ساختار: { itemName → itemSignal, indexName → indexSignal }
    // نکته: اگر parentContext هم signals map داشت، آن را به ارث می‌بریم.
    const parentSignals = parentContext.__zenith_signals__;
    const signalsMap = parentSignals ? new Map(parentSignals) : new Map();
    signalsMap.set(itemName, itemSignal);
    signalsMap.set(indexName, indexSignal);
    // non-enumerable تا در iteration ظاهر نشود.
    Object.defineProperty(child, '__zenith_signals__', {
        value: signalsMap,
        enumerable: false,
        configurable: true,
        writable: false,
    });
    return child;
}
/**
 * FEATURE (v1.0.0): ساخت Context ساده برای fast path (zen-static).
 *
 * تفاوت با createLoopContext:
 *   - هیچ Signal محلی ساخته نمی‌شود (item و index مقادیر ثابت هستند).
 *   - به جای getter با defineProperty، مقادیر مستقیم با defineProperty(value)
 *     ست می‌شوند (ارزان‌تر، اما non-reactive).
 *   - signalsMap ساخته نمی‌شود (zen-model داخل zen-static پشتیبانی نمی‌شود).
 */
function createStaticLoopContext(parentContext, itemName, indexName, item, index) {
    const child = Object.create(parentContext);
    Object.defineProperty(child, `$${itemName}`, {
        value: item,
        enumerable: true,
        configurable: true,
    });
    if (!(itemName in parentContext)) {
        Object.defineProperty(child, itemName, {
            value: item,
            enumerable: true,
            configurable: true,
        });
    }
    Object.defineProperty(child, `$${indexName}`, {
        value: index,
        enumerable: true,
        configurable: true,
    });
    if (!(indexName in parentContext)) {
        Object.defineProperty(child, indexName, {
            value: index,
            enumerable: true,
            configurable: true,
        });
    }
    return child;
}
/**
 * محاسبه کلید یک آیتم.
 *
 * اگر zen-key تعریف شده بود، expression آن در context محلی ارزیابی می‌شود.
 * در غیر این صورت، از index استفاده می‌کنیم (با هشدار).
 */
function computeKey(keyEvalFn, item, index, parentContext, itemName, indexName) {
    if (!keyEvalFn) {
        return String(index);
    }
    // برای ارزیابی expression کلید، یک context موقت می‌سازیم که item و index
    // مقادیر ثابت (نه Signal) داشته باشند.
    const tempContext = Object.create(parentContext);
    // $item و item
    Object.defineProperty(tempContext, `$${itemName}`, {
        value: item,
        enumerable: true,
        configurable: true,
    });
    if (!(itemName in parentContext)) {
        Object.defineProperty(tempContext, itemName, {
            value: item,
            enumerable: true,
            configurable: true,
        });
    }
    // $index و index
    Object.defineProperty(tempContext, `$${indexName}`, {
        value: index,
        enumerable: true,
        configurable: true,
    });
    if (!(indexName in parentContext)) {
        Object.defineProperty(tempContext, indexName, {
            value: index,
            enumerable: true,
            configurable: true,
        });
    }
    let key;
    try {
        key = keyEvalFn(tempContext);
    }
    catch (err) {
        reportError(err, 'expression', { expression: 'zen-key' });
        return String(index);
    }
    return key === null || key === undefined ? String(index) : String(key);
}
/**
 * پردازش دایرکتیو zen-for روی یک عنصر.
 *
 * @param el            عنصر HTML که zen-for روی آن است.
 * @param expr          رشته‌ی expression از `zen-for`.
 * @param context       Context والد (شامل getter های `$user` و …).
 * @param processChildren callback که برای هر آیتم تازه ساخته‌شده فراخوانی
 *                       می‌شود تا فرزندانش با context محلی walk شوند.
 *                      امضای آن: (node, localContext, disposes) => void
 * @returns تابع Dispose برای پاکسازی کل zen-for (effect اصلی + همه‌ی آیتم‌ها).
 */
export function processFor(el, expr, context, processChildren) {
    // ── ۱. پارس کردن سینتکس ──
    const { itemName, indexName, listExpr } = parseForSyntax(expr);
    // FEATURE (v1.0.0): compile-once — listExpr فقط یک‌بار parse می‌شود.
    const listEvalFn = compileExpression(listExpr);
    // ── ۲. ذخیره zen-key قبل از هر تغییری ──
    const keyExpr = el.getAttribute('zen-key');
    // FEATURE (v1.0.0): compile-once — keyExpr فقط یک‌بار parse می‌شود.
    const keyEvalFn = keyExpr ? compileExpression(keyExpr) : null;
    // FEATURE (v1.0.0): zen-static — Fast Path برای لیست‌های فقط‌خواندنی.
    // وقتی attribute `zen-static` وجود دارد:
    //   - per-item Signal (itemSignal/indexSignal) ساخته نمی‌شود.
    //   - createLoopContext (که ۴ defineProperty + signalsMap می‌سازد) اجرا نمی‌شود.
    //   - به جای آن، یک Context ساده با مقادیر مستقیم (نه getter) ساخته می‌شود.
    //   - در تغییر لیست: full re-render (همه dispose + rebuild) به جای keyed diffing.
    // Tradeoff: mount سریع‌تر (۲-۵ برابر)، اما update کندتر (full rebuild).
    const isStatic = el.hasAttribute('zen-static');
    // اگر zen-key وجود نداشت، هشدار بده (اما ادامه بده با fallback به index).
    if (!keyExpr) {
        // FEATURE (v1.0.0): پیام هشدار بهبودیافته با مثال از کتابخانه‌ی خطاها.
        console.warn(zenForNoZenKeyError(expr).toUserString());
    }
    // ── ۳. ساخت Template ──
    // عنصر اصلی را clone می‌کنیم و zen-for / zen-key را از clone برمی‌داریم.
    // هر آیتم لیست یک نسخه از این template می‌گیرد.
    // BUG FIX (v7.0): ذخیره‌ی zen-transition روی template تا آیتم‌های جدید/حذف‌شده
    // هم enter/leave animation داشته باشند.
    const transitionName = el.getAttribute('zen-transition');
    const template = el.cloneNode(true);
    template.removeAttribute('zen-for');
    template.removeAttribute('zen-key');
    // FEATURE (v1.0.0): zen-static را هم از template حذف کن تا روی cloneها نباشد.
    template.removeAttribute('zen-static');
    if (transitionName) {
        template.setAttribute('zen-transition', transitionName);
    }
    // ── ۴. جایگزینی عنصر اصلی با Comment placeholder ──
    // این comment به عنوان anchor برای insert/move/delete عمل می‌کند.
    const parent = el.parentElement;
    if (!parent) {
        throw new Error('[zen-for] Element must have a parent node.');
    }
    const placeholder = document.createComment(`zen-for: ${listExpr}`);
    parent.replaceChild(placeholder, el);
    // ── ۵. نگه‌داشتن ردیابی آیتم‌های رندرشده ──
    // Map از key به LoopItem. هر key یک DOM node نگه می‌دارد.
    const itemsByKey = new Map();
    // FEATURE (v1.0.0): در حالت zen-static، همه آیتم‌ها در یک آرایه ساده نگه‌داری
    // می‌شوند (نه Map با key). روی تغییر لیست، همه dispose + rebuild می‌شوند.
    const staticItems = [];
    // ── ۶. Effect اصلی: هر بار که آرایه تغییر کند، این تابع اجرا می‌شود ──
    const disposeEffect = effect(() => {
        // FEATURE (v1.0.0): compile-once — listEvalFn فقط evaluate می‌کند.
        const list = listEvalFn(context);
        const arr = Array.isArray(list) ? list : [];

        // ── FEATURE (v1.0.0): Fast Path (zen-static) ──
        // در حالت static، روی تغییر لیست، همه آیتم‌های قبلی dispose + remove می‌شوند
        // و همه آیتم‌های جدید از ابتدا ساخته می‌شوند.
        if (isStatic) {
            // پاکسازی همه‌ی آیتم‌های قبلی.
            for (const it of staticItems) {
                for (const d of it.disposes) {
                    try { d(); } catch (e) { console.error('[zen-for] static dispose failed:', e); }
                }
                it.disposes.length = 0;
                if (it.node.parentNode === parent) parent.removeChild(it.node);
            }
            staticItems.length = 0;

            // FEATURE (v1.0.0): DocumentFragment batching — همه‌ی نودهای جدید را در
            // یک fragment جمع می‌کنیم و یک‌بار insert می‌کنیم.
            const frag = document.createDocumentFragment();
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                const newNode = template.cloneNode(true);
                const localContext = createStaticLoopContext(context, itemName, indexName, item, i);
                const disposes = [];
                processChildren(newNode, localContext, disposes);
                const loopItem = { node: newNode, disposes };
                staticItems.push(loopItem);
                frag.appendChild(newNode);
            }
            parent.insertBefore(frag, placeholder.nextSibling);
            return;
        }

        // ── Standard Path (keyed diffing) ──
        // کلیدهایی که در این اجرا استفاده شده‌اند (برای detect حذف‌ها).
        const usedKeys = new Set();
        // FEATURE (v1.0.0): DocumentFragment batching برای initial mount.
        const isInitialMount = itemsByKey.size === 0;
        let batchFrag = isInitialMount ? document.createDocumentFragment() : null;
        // آیتم‌های جدید را به ترتیب در DOM قرار می‌دهیم.
        let prevNode = placeholder;
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            // محاسبه‌ی کلید این آیتم.
            const key = computeKey(keyEvalFn, item, i, context, itemName, indexName);
            // BUG FIX (BUG-08): کلیدهای index همیشه یکتا هستند (i یکتا است)،
            // پس بررسی برای حالت !keyExpr مرده بود. اما برای zen-key، کلیدهای
            // تکراری معنادار هستند — هشدار می‌دهیم.
            if (keyExpr && usedKeys.has(key)) {
                console.warn(`[zen-for] Duplicate key "${key}" detected. Keys must be unique. DOM may render incorrectly.`);
            }
            usedKeys.add(key);
            // آیا این کلید از قبل در DOM وجود دارد؟
            let loopItem = itemsByKey.get(key);
            if (loopItem) {
                // ── آپدیت آیتم موجود ──
                if (loopItem.itemSignal) loopItem.itemSignal.set(item);
                if (loopItem.indexSignal) loopItem.indexSignal.set(i);
                if (batchFrag) {
                    batchFrag.appendChild(loopItem.node);
                } else {
                    const expectedNext = prevNode.nextSibling;
                    if (loopItem.node !== expectedNext) {
                        parent.insertBefore(loopItem.node, expectedNext);
                    }
                }
            }
            else {
                // ── ساخت آیتم جدید ──
                const newNode = template.cloneNode(true);
                // Signalهای محلی برای این آیتم.
                const itemSignal = signal(item);
                const indexSignal = signal(i);
                // Context محلی که $item و $index روی آن تعریف شده‌اند.
                const localContext = createLoopContext(context, itemName, indexName, itemSignal, indexSignal);
                const disposes = [];
                processChildren(newNode, localContext, disposes);
                // BUG FIX (v7.0): enter transition برای آیتم‌های جدید.
                const itemTransition = newNode.getAttribute('zen-transition');
                if (itemTransition) {
                    cancelTransition(newNode);
                    newNode.classList.add(itemTransition);
                    newNode.classList.add('zen-enter-from');
                    newNode.classList.add('zen-enter-active');
                }
                loopItem = { node: newNode, itemSignal, indexSignal, disposes };
                itemsByKey.set(key, loopItem);
                if (batchFrag) {
                    batchFrag.appendChild(newNode);
                }
            }
            if (!batchFrag) {
                const expectedNext = prevNode.nextSibling;
                const isNewlyInserted = loopItem.node.parentNode !== parent;
                if (loopItem.node !== expectedNext) {
                    parent.insertBefore(loopItem.node, expectedNext);
                }
                // enter transition را فقط برای آیتم‌های تازه‌وارد (نه move‌ها) اجرا کن.
                if (isNewlyInserted) {
                    const itemTransition = loopItem.node.getAttribute('zen-transition');
                    if (itemTransition) {
                        enterTransition(loopItem.node, itemTransition);
                    }
                }
            }
            prevNode = loopItem.node;
        }
        // FEATURE (v1.0.0): اگر در حالت batch بودیم، حالا fragment را یک‌بار insert کن.
        if (batchFrag && batchFrag.childNodes.length > 0) {
            parent.insertBefore(batchFrag, placeholder.nextSibling);
            // enter transition برای آیتم‌های تازه‌وارد در batch mode.
            for (const [, loopItem] of itemsByKey.entries()) {
                const itemTransition = loopItem.node.getAttribute('zen-transition');
                if (itemTransition) {
                    enterTransition(loopItem.node, itemTransition);
                }
            }
        }
        // ── ۷. پاکسازی آیتم‌های حذفشده ──
        for (const [key, loopItem] of itemsByKey.entries()) {
            if (!usedKeys.has(key)) {
                const itemTransition = loopItem.node.getAttribute('zen-transition');
                if (itemTransition && loopItem.node.parentNode === parent) {
                    const node = loopItem.node;
                    const disposes = loopItem.disposes;
                    leaveTransition(node, itemTransition, 300, () => {
                        for (const dispose of disposes) {
                            try {
                                dispose();
                            }
                            catch (err) {
                                console.error('[zen-for] Error during dispose of removed item:', err);
                            }
                        }
                        if (node.parentNode === parent) {
                            parent.removeChild(node);
                        }
                    });
                    itemsByKey.delete(key);
                }
                else {
                    for (const dispose of loopItem.disposes) {
                        try {
                            dispose();
                        }
                        catch (err) {
                            console.error('[zen-for] Error during dispose of removed item:', err);
                        }
                    }
                    loopItem.disposes.length = 0;
                    if (loopItem.node.parentNode === parent) {
                        parent.removeChild(loopItem.node);
                    }
                    itemsByKey.delete(key);
                }
            }
        }
    });
    // ── ۸. تابع Dispose کل zen-for ──
    // این تابع توسط walker هنگام teardown کل اپ (Zen.stop) فراخوانی می‌شود.
    return () => {
        // Effect اصلی را dispose کن.
        disposeEffect();
        // FEATURE (v1.0.0): پاکسازی آیتم‌های static (اگر در حالت zen-static بود).
        for (const loopItem of staticItems) {
            for (const dispose of loopItem.disposes) {
                try {
                    dispose();
                }
                catch (err) {
                    console.error('[zen-for] Error during teardown dispose:', err);
                }
            }
            loopItem.disposes.length = 0;
            if (loopItem.node.parentNode === parent) {
                parent.removeChild(loopItem.node);
            }
        }
        staticItems.length = 0;
        // همه‌ی آیتم‌های باقی‌مانده (keyed path) را unmount کن.
        for (const [, loopItem] of itemsByKey.entries()) {
            for (const dispose of loopItem.disposes) {
                try {
                    dispose();
                }
                catch (err) {
                    console.error('[zen-for] Error during teardown dispose:', err);
                }
            }
            loopItem.disposes.length = 0;
            if (loopItem.node.parentNode === parent) {
                parent.removeChild(loopItem.node);
            }
        }
        itemsByKey.clear();
        // placeholder هم حذف کن.
        if (placeholder.parentNode === parent) {
            parent.removeChild(placeholder);
        }
    };
}
//# sourceMappingURL=for.js.map