// packages/stateful/src/resource-view.ts
//
// FEATURE (v0.6.0): zen-resource-view — کامپوننت Stateful برای نمایش
// وضعیت‌های یک Resource (loading / error / empty / success).
//
// این کامپوننت به‌صورت خودکار state machine یک Resource را مدیریت می‌کند:
//   - loading  → نمایش اسپینر "در حال بارگذاری..."
//   - error    → نمایش پیام خطا + دکمه‌ی "تلاش مجدد"
//   - empty    → نمایش "موردی یافت نشد"
//   - success  → رندر تمپلیت کاربر روی resource.data (شبه zen-for)
//
// ── سینتکس ──
//
//   <zen-resource-view config="$usersResource">
//     <template>
//       <div zen-text="$item.name"></div>
//     </template>
//   </zen-resource-view>
//
// ─ـ پیش‌نیازها ─ـ
//
//   کاربر باید یک Resource در State خود قرار دهد:
//
//   import { createResource } from '@zenith/resource';
//   const usersResource = createResource('users', { url: '/api/users' });
//   Zen.start(app, { usersResource });
//   usersResource.list();  // شروع fetch اولیه
//
// ─ـ نکات طراحی ─ـ
//
//   - ما `effect` را روی `resource.signal` می‌گذاریم. هر بار که signal
//     تغییر کند (مثلاً fetch کامل شد)، effect دوباره اجرا می‌شود و slot
//     مناسب را render می‌کند.
//   - در حالت success، از keyed diffing (شبه zen-for) استفاده می‌کنیم
//     تا هنگام تغییر data، کل DOM بازسازی نشود و state داخلی (focus،
//     انیمیشن، و ...) حفظ شود. کلید هر آیتم از فیلد `id` آن گرفته می‌شود
//     (یا fallback به index).
//   - retry button یک event listener محلی attaches می‌کند که `resource.list(true)`
//     را صدا می‌زند (force refresh).
//   - SSR-safe: اگر `document` تعریف نشده باشد، no-op می‌شود.
//
// ──disposeـ
//
//   effect اصلی + تمام effectهای فرزندان آیتم‌های رندرشده هنگام teardown
//   پاکسازی می‌شوند تا memory leak نباشد.

import { effect, signal } from '@zenith/state';
import { walkAndBind } from '@zenith/runtime';

/**
 * متون پیش‌فرض فارسی برای slotهای داخلی.
 * کاربر می‌تواند با attributeهای `loading-text`, `error-text`, `empty-text`,
 * `retry-text` آنها را override کند.
 */
const DEFAULT_LOADING_TEXT = 'در حال بارگذاری...';
const DEFAULT_EMPTY_TEXT = 'موردی یافت نشد';
const DEFAULT_RETRY_TEXT = 'تلاش مجدد';

/**
 * Type guard برای تشخیص Resource.
 */
function isResourceLike(value) {
    return (value !== null &&
        typeof value === 'object' &&
        typeof value.signal === 'object' &&
        value.signal !== null &&
        typeof value.signal.get === 'function' &&
        typeof value.list === 'function');
}

/**
 * پردازشگر دایرکتیو zen-resource-view.
 *
 * این تابع توسط walker (از طریق custom directive registry) فراخوانی
 * می‌شود. خروجی آن یک تابع dispose است که effect اصلی و تمام آیتم‌های
 * رندرشده را پاکسازی می‌کند.
 *
 * @param el         عنصر <zen-resource-view>.
 * @param configAttr مقدار attribute `config` (مثلاً `"$usersResource"`).
 * @param context    Context والد (شامل getterهای `$user`, `$usersResource` و ...).
 * @param state      State اصلی (شامل Signalها و Resourceها).
 * @returns تابع Dispose.
 */
export function processResourceView(el, configAttr, context, state) {
    // SSR-safe guard: بدون document، هیچ کاری نمی‌توان کرد.
    if (typeof document === 'undefined') {
        return () => { };
    }
    // ── ۱. اعتبارسنجی config attribute ──
    if (!configAttr || configAttr.trim().length === 0) {
        console.warn('[zen-resource-view] Missing or empty `config` attribute.');
        return () => { };
    }
    // نرمال‌سازی: کاربر می‌تواند بنویسد `config="$usersResource"` یا `config="usersResource"`.
    // در هر دو حالت، نام کلید در context با پیشوند `$` است.
    const refName = configAttr.startsWith('$') ? configAttr : `$${configAttr}`;
    // FEATURE (v0.6.0): استخراج Resource از context.
    // نکته: این دسترسی getter را فراخوانی نمی‌کند چون Resourceها معمولاً به‌صورت
    // plain object در state ذخیره می‌شوند (نه به‌صورت Signal). اما اگر کاربر
    // آن را به‌صورت Signal<ResourceState> ذخیره کرده باشد، مقدار برگشتی
    // ResourceState خواهد بود که `list` ندارد — در این صورت هشدار می‌دهیم.
    const resource = context[refName];
    if (!isResourceLike(resource)) {
        console.warn(`[zen-resource-view] Resource "${configAttr}" not found in context or is not a Resource. ` +
            `Make sure you pass the Resource instance (from createResource) in your state, not its signal. ` +
            `Example: Zen.start(app, { usersResource: createResource('users', {...}) });`);
        return () => { };
    }
    // ── ۲. استخراج <template> کاربر ──
    // کاربر باید یک (و فقط یک) <template> به‌عنوان فرزند مستقیم قرار دهد.
    // این template در حالت success برای هر آیتم clone می‌شود.
    const userTemplate = el.querySelector(':scope > template');
    if (!userTemplate) {
        console.warn('[zen-resource-view] No <template> child found. ' +
            'Provide a template for the success state:\n' +
            '  <zen-resource-view config="$usersResource">\n' +
            '    <template><div zen-text="$item.name"></div></template>\n' +
            '  </zen-resource-view>');
        return () => { };
    }
    // ─ـ ۳. خواندن attributeهای سفارشی‌سازی (override متون پیش‌فرض) ──
    const loadingText = el.getAttribute('loading-text') || DEFAULT_LOADING_TEXT;
    const emptyText = el.getAttribute('empty-text') || DEFAULT_EMPTY_TEXT;
    const retryText = el.getAttribute('retry-text') || DEFAULT_RETRY_TEXT;
    // ── ۴. آماده‌سازی container ──
    // کل محتوای داخلی element را پاک می‌کنیم (شامل template کاربر، چون آن را
    // در متغیر `userTemplate` ذخیره کرده‌ایم). از این پس، ما مدیریت محتوای
    // داخلی را بر عهده می‌گیریم.
    el.innerHTML = '';
    // ── ۵. Map برای keyed diffing در حالت success ──
    // کلید → آیتم رندرشده. این الگو شبیه zen-for است.
    const itemsByKey = new Map();
    // dispose‌های مربوط به slotهای loading/error/empty (retry button listener و ...).
    // این disposeها هنگام transition به slot دیگر پاکسازی می‌شوند.
    let slotDispose = null;
    /**
     * پاکسازی slot فعلی (غیر از success).
     * این تابع innerHTML را خالی نمی‌کند چون renderXxx آن را انجام می‌دهد.
     */
    function clearSlot() {
        if (slotDispose) {
            try {
                slotDispose();
            }
            catch (err) {
                console.error('[zen-resource-view] Error during slot dispose:', err);
            }
            slotDispose = null;
        }
    }
    /**
     * پاکسازی تمام آیتم‌های رندرشده در حالت success.
     */
    function clearItems() {
        for (const item of itemsByKey.values()) {
            try {
                item.dispose();
            }
            catch (err) {
                console.error('[zen-resource-view] Error during item dispose:', err);
            }
            if (item.node.parentNode === el) {
                el.removeChild(item.node);
            }
        }
        itemsByKey.clear();
    }
    /**
     * رندر slot loading.
     */
    function renderLoading() {
        clearSlot();
        clearItems();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'zen-resource-loading';
        loadingEl.setAttribute('role', 'status');
        loadingEl.setAttribute('aria-live', 'polite');
        loadingEl.textContent = loadingText;
        el.appendChild(loadingEl);
    }
    /**
     * رندر slot error شامل دکمه‌ی retry.
     */
    function renderError(message) {
        clearSlot();
        clearItems();
        const errorEl = document.createElement('div');
        errorEl.className = 'zen-resource-error';
        errorEl.setAttribute('role', 'alert');
        const msgEl = document.createElement('div');
        msgEl.className = 'zen-resource-error-message';
        msgEl.textContent = message;
        errorEl.appendChild(msgEl);
        const retryBtn = document.createElement('button');
        retryBtn.className = 'zen-resource-retry';
        retryBtn.type = 'button';
        retryBtn.textContent = retryText;
        const onRetry = () => {
            // force refresh — cache نادیده گرفته می‌شود.
            resource.list(true).catch((err) => {
                console.error('[zen-resource-view] Retry failed:', err);
            });
        };
        retryBtn.addEventListener('click', onRetry);
        errorEl.appendChild(retryBtn);
        el.appendChild(errorEl);
        // ثبت dispose برای حذف event listener.
        slotDispose = () => {
            retryBtn.removeEventListener('click', onRetry);
        };
    }
    /**
     * رندر slot empty.
     */
    function renderEmpty() {
        clearSlot();
        clearItems();
        const emptyEl = document.createElement('div');
        emptyEl.className = 'zen-resource-empty';
        emptyEl.textContent = emptyText;
        el.appendChild(emptyEl);
    }
    /**
     * محاسبه‌ی کلید یک آیتم.
     * اگر آیتم شیء با فیلد `id` باشد، از آن استفاده می‌کنیم. در غیر این صورت،
     * fallback به index.
     */
    function computeKey(item, index) {
        if (item !== null && typeof item === 'object' && 'id' in item) {
            const id = item.id;
            if (id !== null && id !== undefined)
                return String(id);
        }
        return String(index);
    }
    /**
     * رندر slot success با keyed diffing روی resource.data.
     *
     * این تابع شبیه به processFor (zen-for) عمل می‌کند:
     *   - آیتم‌های جدید: clone از template + walkAndBind با context محلی.
     *   - آیتم‌های موجود: فقط Signalهای محلی را update می‌کنیم.
     *   - آیتم‌های حذفشده: dispose + remove.
     */
    function renderSuccess(data) {
        clearSlot();
        // اگر data آرایه نبود (مثلاً یک شیء واحد)، آن را به آرایه‌ی تک‌عضوی تبدیل می‌کنیم.
        const arr = Array.isArray(data)
            ? data
            : (data !== null && data !== undefined ? [data] : []);
        const usedKeys = new Set();
        let prevNode = null;
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            const key = computeKey(item, i);
            // جلوگیری از کلید تکراری (در حالت fallback به index).
            if (usedKeys.has(key))
                continue;
            usedKeys.add(key);
            let existing = itemsByKey.get(key);
            if (existing) {
                // ─ـ آپدیت آیتم موجود ──
                // فقط Signalهای محلی را set می‌کنیم. effectهای فرزندان به‌صورت خودکار
                // re-run می‌شوند.
                existing.itemSignal.set(item);
                existing.indexSignal.set(i);
            }
            else {
                // ─ـ ساخت آیتم جدید ──
                let clone;
                const firstChild = userTemplate.content.firstElementChild;
                if (firstChild && firstChild === userTemplate.content.lastElementChild) {
                    // تک top-level element: مستقیماً clone کن.
                    clone = firstChild.cloneNode(true);
                }
                else {
                    // چند top-level یا text: در یک wrapper قرار بده.
                    clone = document.createElement('div');
                    clone.className = 'zen-resource-item-wrapper';
                    clone.appendChild(userTemplate.content.cloneNode(true));
                }
                // Signalهای محلی برای این آیتم.
                const itemSignal = signal(item);
                const indexSignal = signal(i);
                // FEATURE (v0.6.0): ساخت local state برای walkAndBind.
                // walkAndBind یک context تازه از state می‌سازد. برای اینکه $item
                // و $index در دسترس باشند، آنها را در state قرار می‌دهیم.
                // همچنین تمام state والد را spread می‌کنیم تا $user, $usersResource
                // و سایر کلیدها در دسترس باشند.
                const localState = Object.assign(Object.assign({}, state), { item: itemSignal, index: indexSignal });
                // Walk کردن clone با local state.
                const childDispose = walkAndBind(clone, localState);
                existing = {
                    node: clone,
                    itemSignal,
                    indexSignal,
                    dispose: childDispose,
                };
                itemsByKey.set(key, existing);
            }
            // ── مدیریت DOM Order ──
            // اگر نود در جای درست نیست، آن را جابجا کن.
            const expectedNext = prevNode ? prevNode.nextSibling : el.firstChild;
            if (existing.node !== expectedNext) {
                el.insertBefore(existing.node, expectedNext);
            }
            prevNode = existing.node;
        }
        // ─ـ پاکسازی آیتم‌های حذفشده ──
        for (const [key, item] of itemsByKey.entries()) {
            if (!usedKeys.has(key)) {
                try {
                    item.dispose();
                }
                catch (err) {
                    console.error('[zen-resource-view] Error during removed item dispose:', err);
                }
                if (item.node.parentNode === el) {
                    el.removeChild(item.node);
                }
                itemsByKey.delete(key);
            }
        }
    }
    // ── ۶. Effect اصلی: watch کردن resource.signal ──
    // هر بار که signal تغییر کند (loading → success، success → error، ...),
    // این effect دوباره اجرا می‌شود و slot مناسب را render می‌کند.
    const disposeEffect = effect(() => {
        const st = resource.signal.get();
        // اولویت‌بندی:
        //   1) loading && data === null → loading slot
        //   2) error → error slot
        //   3) data === null || empty array → empty slot
        //   4) success → render items
        //
        // نکته: اگر loading=true اما data از قبل موجود است (مثلاً background
        // refresh)، داده‌ی قبلی را نمایش می‌دهیم تا flicker نباشد. این الگو
        // stale-while-revalidate نامیده می‌شود.
        if (st.loading && (st.data === null || st.data === undefined)) {
            renderLoading();
            return;
        }
        if (st.error) {
            renderError(st.error);
            return;
        }
        if (st.data === null || st.data === undefined) {
            renderEmpty();
            return;
        }
        if (Array.isArray(st.data) && st.data.length === 0) {
            renderEmpty();
            return;
        }
        // حالت success.
        renderSuccess(st.data);
    });
    // ── ۷. تابع Dispose کل ──
    // این تابع توسط walker هنگام teardown کل اپ (Zen.stop) فراخوانی می‌شود.
    return () => {
        try {
            disposeEffect();
        }
        catch (err) {
            console.error('[zen-resource-view] Error during effect dispose:', err);
        }
        clearSlot();
        clearItems();
    };
}
//# sourceMappingURL=resource-view.js.map
