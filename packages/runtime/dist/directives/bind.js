// packages/runtime/src/directives/bind.ts
//
// دایرکتیو zen-bind:*: اتصال Expression به Attributeهای HTML.
//
// کاربرد:
//   <img zen-bind:src="$user.avatar">
//   <a zen-bind:href="$post.url">Read more</a>
//   <button zen-bind:disabled="$isProcessing">Save</button>
//   <div zen-bind:class="{ active: $isActive, 'text-red': $hasError }">...</div>
//   <input zen-bind:value="$user.name">
//
// سه حالت خاص:
//   1) zen-bind:class با آبجکت: مدیریت هوشمند کلاس‌ها
//   2) zen-bind:disabled / checked / readonly: Boolean Attributes
//   3) سایر Attributeها: setAttribute / removeAttribute
//
// Memory Leak Prevention:
//   وقتی عنصر unmount شود، Effect این دایرکتیو باید dispose شود.
//   walker این کار را با فراخوانی تابع Dispose برگردانده‌شده انجام می‌دهد.
import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — AST یک‌بار parse می‌شود و در closure ذخیره
// می‌شود. در هر re-runِ Effect، فقط evaluate(ast, ctx) اجرا می‌شود (بدون cache.has/get/delete/set).
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
/**
 * لیست Attributeهایی که Boolean هستند (وجود یا عدم وجودشان مهم است، نه مقدارشان).
 *
 * در HTML استاندارد:
 *   <input disabled>      → disabled
 *   <input disabled="">  → disabled
 *   <input disabled="false"> → باز هم disabled! (HTML booleans عجیب هستند)
 *
 * ما از removeAttribute/setAttribute استفاده می‌کنیم تا رفتار صحیح داشته باشیم.
 */
const BOOLEAN_ATTRIBUTES = new Set([
    'disabled',
    'checked',
    'readonly',
    'required',
    'multiple',
    'autofocus',
    'selected',
]);
/**
 * Marker برای کلاس‌های مدیریت‌شده توسط zen-bind:class.
 *
 * چون وقتی مقدار آبجکت کلاس‌ها تغییر می‌کند، باید کلاس‌های قبلی که
 * حذف شده‌اند را هم از DOM پاک کنیم. این data-attribute لیست کلاس‌هایی
 * که خودمان اضافه کرده‌ایم را نگه می‌دارد.
 */
const MANAGED_CLASSES_ATTR = 'data-zenith-managed-classes';
// SEC FIX (v1.2.6): SEC-A2 — URL attribute allow-list + dangerous-protocol check.
// zen-bind:href/src/etc. could previously be set to `javascript:...` URLs,
// enabling XSS when the user clicked the link. We now block dangerous URL
// schemes before setAttribute.
//
// Why not depend on @zenith/security here? Doing so would create a runtime ↔
// security import cycle (security already pulls in runtime DOM globals). The
// protocol check is small enough to inline safely.
const URL_ATTRS = new Set([
    'href',
    'src',
    'action',
    'formaction',
    'xlink:href',
    'data',
    'srcset',
    'cite',
    'poster',
    'background',
]);
/**
 * SEC FIX (v1.2.6): SEC-A2 — Returns true if the given URL string uses a
 * dangerous scheme that can execute script when navigated/loaded.
 *
 * Allowed: http(s):, mailto:, tel:, ftp:, relative URLs (no scheme), and
 * data:image/... (inline images are safe and commonly used for avatars).
 * Blocked: javascript:, vbscript:, and data: with any non-image MIME.
 */
function hasDangerousUrlProtocol(value) {
    // Normalize: strip leading whitespace/control chars which browsers ignore
    // when parsing URLs (e.g. `java\x00script:` or `  javascript:`).
    const normalized = String(value)
        .replace(/[\u0000-\u0020]+/g, '')
        .toLowerCase();
    // Relative URLs and fragment-only URLs have no scheme — safe.
    const schemeMatch = /^([a-z][a-z0-9+.\-]*):/.exec(normalized);
    if (!schemeMatch)
        return false;
    const scheme = schemeMatch[1];
    if (scheme === 'javascript' || scheme === 'vbscript')
        return true;
    if (scheme === 'data') {
        // data:image/* is allowed; everything else (text/html, application/...) is not.
        return !/^data:image\//.test(normalized);
    }
    return false;
}
/**
 * دریافت لیست کلاس‌های مدیریت‌شده قبلی از یک عنصر.
 */
function getManagedClasses(el) {
    const attr = el.getAttribute(MANAGED_CLASSES_ATTR);
    if (!attr)
        return [];
    return attr.split(',').filter(Boolean);
}
/**
 * ذخیره‌ی لیست کلاس‌های مدیریت‌شده روی یک عنصر.
 */
function setManagedClasses(el, classes) {
    if (classes.length === 0) {
        el.removeAttribute(MANAGED_CLASSES_ATTR);
    }
    else {
        el.setAttribute(MANAGED_CLASSES_ATTR, classes.join(','));
    }
}
/**
 * پردازش دایرکتیو zen-bind روی یک عنصر.
 *
 * @param el عنصر HTML.
 * @param attrName نام Attribute (بدون پیشوند `zen-bind:`).
 * @param expr رشته‌ی Expression.
 * @param context آبجکت Context.
 * @returns تابع Dispose برای پاکسازی.
 */
export function processBind(el, attrName, expr, context) {
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse/validate می‌شود.
    const evalFn = compileExpression(expr);
    // FEATURE (v1.0.0): Property Diffing — مقدار قبلی را در closure ذخیره می‌کنیم.
    // اگر مقدار جدید با قبلی از نظر reference برابر باشد (===)، از mutation DOM
    // صرف‌نظر می‌کنیم. این کار setAttributeهای غیرضروری را حذف می‌کند.
    //
    // برای primitives (string/number/boolean): === value comparison دقیق است.
    // برای objects (class object): === reference comparison — اگر کاربر آبجکت جدید
    // نسازد، آپدیت رخ نمی‌دهد که این رفتار صحیحی است (immutable pattern).
    // برای null/undefined: handled by === (null === null → true).
    let prevValue = undefined;
    let isFirstRun = true;
    const dispose = effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch (err) {
            reportError(err, 'expression', { expression: expr, element: el });
            return;
        }
        // FEATURE (v1.0.0): Property Diffing — اگر مقدار با قبلی برابر است، skip کن.
        // در اولین اجرا همیشه ادامه می‌دهیم تا مقدار اولیه set شود.
        if (!isFirstRun && prevValue === value) {
            return;
        }
        prevValue = value;
        isFirstRun = false;
        // ── حالت ۱: zen-bind:class با آبجکت ──
        // مثال: zen-bind:class="{ active: $isActive, 'text-red': $hasError }"
        // FIX (v1.2.4): Special-case Array value for `class` — iterate the array
        // and add/remove classes. Supports e.g.
        //   zen-bind:class="['active', $hasError ? 'text-red' : '']"
        // This branch MUST run before the object-class check below so arrays are
        // not accidentally treated as plain objects.
        if (attrName === 'class' && Array.isArray(value)) {
            const managedClasses = new Set(getManagedClasses(el));
            const newSet = new Set(value.filter((c) => c).map((c) => String(c)));
            // Remove previously-managed classes that are no longer in the array.
            for (const className of managedClasses) {
                if (!newSet.has(className)) {
                    el.classList.remove(className);
                    managedClasses.delete(className);
                }
            }
            // Add new classes from the array.
            for (const className of newSet) {
                el.classList.add(className);
                managedClasses.add(className);
            }
            setManagedClasses(el, [...managedClasses]);
            return;
        }
        if (attrName === 'class' && typeof value === 'object' && value !== null) {
            const managedClasses = new Set(getManagedClasses(el));
            // ابتدا کلاس‌های قبلی که دیگر true نیستند را حذف کن.
            for (const className of managedClasses) {
                if (!(className in value) || !value[className]) {
                    el.classList.remove(className);
                    managedClasses.delete(className);
                }
            }
            // سپس کلاس‌های جدیدی که true هستند را اضافه کن.
            for (const className in value) {
                if (value[className]) {
                    el.classList.add(className);
                    managedClasses.add(className);
                }
            }
            setManagedClasses(el, [...managedClasses]);
            return;
        }
        // ── حالت ۲: Boolean Attributes (disabled, checked, ...) ──
        // FIX (v1.2.4): For `value` or `checked` on form elements, use direct
        // property assignment instead of setAttribute. setAttribute('value', ...)
        // does NOT update the live `.value` property after user input on
        // <input>/<textarea>/<select>, which breaks controlled-input flows.
        // Similarly, `.checked` is the canonical state for checkboxes/radios.
        // This branch runs before BOOLEAN_ATTRIBUTES so `checked` reaches the
        // property path rather than the boolean-attribute path.
        if (attrName === 'value' || attrName === 'checked') {
            const tag = (el.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') {
                el[attrName] = value == null ? '' : value;
                return;
            }
        }
        if (BOOLEAN_ATTRIBUTES.has(attrName)) {
            if (value) {
                el.setAttribute(attrName, '');
            }
            else {
                el.removeAttribute(attrName);
            }
            return;
        }
        // ── حالت ۳: سایر Attributeها ──
        // null/undefined/false → حذف Attribute
        if (value === null || value === undefined || value === false) {
            el.removeAttribute(attrName);
        }
        else {
            // SEC FIX (v1.2.6): SEC-A2 — block dangerous URL protocols on URL-like
            // attributes. If the bound value is `javascript:alert(1)` (or vbscript:,
            // or data:text/html,...), we strip the attribute and bail instead of
            // passing it to setAttribute. This prevents zen-bind:href from being
            // weaponised into a click-to-XSS sink.
            if (URL_ATTRS.has(attrName) && hasDangerousUrlProtocol(String(value))) {
                el.removeAttribute(attrName);
                return;
            }
            el.setAttribute(attrName, String(value));
        }
    });
    return dispose;
}
//# sourceMappingURL=bind.js.map