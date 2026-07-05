// packages/state/src/registry.ts
//
// State Registry — ردیابی تمام Signal های ساخته‌شده (فاز ۱۰).
//
// این ماژول یک رجیستری سراسری از تمام Signal هایی که در طول اجرای اپلیکیشن
// ساخته می‌شوند نگه می‌دارد. این کار برای ابزارهای توسعه (DevTools) ضروری است
// تا بتوانند:
//   - تمام State های فعال را بازرسی کنند.
//   - تغییرات State را در یک Timeline نمایش دهند.
//   - وابستگی‌ها (dependency graph) را visualize کنند.
//
// ── نکات طراحی ──
//
// 1) Optional:
//    این رجیستری به‌صورت پیش‌فرض فعال است اما اگر `__ZENITH_DEVTOOLS__=false`
//    در global (window یا globalThis) تنظیم شود، غیرفعال می‌شود. این برای
//    production مهم است تا overhead ردیابی حذف شود.
//
// 2) WeakMap + WeakRef برای جلوگیری از Memory Leak:
//    Bug Fix #5: قبلاً idToInfo یک Map معمولی بود و SignalInfo شامل
//    reference مستقیم به Signal بود. این یعنی Signal ها هرگز GC نمی‌شدند
//    چون رجیستری به آن‌ها reference قوی داشت. در اپ‌های بزرگ با هزاران
//    Signal کوتاه‌عمر (مثلاً در zen-for با remount مکرر)، رجیستری رشد می‌کرد.
//
//    راه‌حل:
//      - signalToId: WeakMap<Signal, number> — به Signal به‌صورت weak reference.
//      - idToInfo: Map<number, SignalInfo> که SignalInfo شامل WeakRef<Signal> است.
//      - cleanupDisposedSignals() اکنون واقعاً کار می‌کند: هر entry که
//        signalRef.deref() آن undefined برمی‌گرداند (GC شده) را حذف می‌کند.
//      - FinalizationRegistry هم اضافه شده تا وقتی Signal ای GC می‌شود،
//        به‌طور خودکار از idToInfo حذف شود.
//
// 3) No-Op در Production:
//    اگر DevTools فعال نباشد، تمام توابع این ماژول no-op می‌شوند تا هیچ
//    overhead در production نداشته باشد.
/**
 * Flag سراسری برای فعال/غیرفعال کردن DevTools.
 */
function isDevtoolsEnabled() {
    if (typeof globalThis === 'undefined')
        return false;
    const devtoolsFlag = globalThis.__ZENITH_DEVTOOLS__;
    if (devtoolsFlag === true)
        return true;
    if (devtoolsFlag === false)
        return false;
    const devFlag = globalThis.__ZENITH_DEV__;
    return devFlag !== false;
}
/**
 * Map از Signal → ID (WeakMap — به Signal به‌صورت weak reference).
 *
 * نکته: `let` (نه `const`) چون در `clearRegistry` آن را reassign می‌کنیم.
 */
let signalToId = new WeakMap();
/**
 * Map از ID → SignalInfo.
 *
 * Bug Fix #5: SignalInfo اکنون شامل WeakRef<Signal> است (نه Signal مستقیم).
 * این به GC اجازه می‌دهد Signal های dispose شده را پاک کند.
 * همچنین cleanupDisposedSignals() اکنون واقعاً کار می‌کند.
 */
const idToInfo = new Map();
/**
 * شمارنده‌ی ID برای Signal های جدید.
 */
let nextSignalId = 1;
/**
 * FinalizationRegistry برای پاکسازی خودکار Signal های GC شده.
 *
 * Bug Fix #5: وقتی یک Signal توسط GC جمع‌آوری می‌شود، این callback
 * فراخوانی می‌شود و ما آن را از idToInfo حذف می‌کنیم.
 *
 * نکته: FinalizationRegistry در تمام محیط‌ها available است (Node 14.6+،
 * تمام مرورگرهای مدرن). اگر available نباشد، fallback به cleanupDisposedSignals
 * در getAllSignals است.
 */
const finalizationRegistry = typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry((id) => {
        idToInfo.delete(id);
    })
    : null;
/**
 * لیست تغییرات State (Timeline).
 */
const MAX_TIMELINE_SIZE = 1000;
const stateChangeTimeline = [];
/**
 * لیست callback هایی که روی هر تغییر State فراخوانی می‌شوند.
 */
const stateChangeListeners = [];
/**
 * ثبت یک Signal در رجیستری.
 *
 * @param sig  Signal که ساخته شده.
 * @param name نام اختیاری Signal (برای دیباگ).
 * @returns ID اختصاص داده شده به Signal.
 */
export function registerSignal(sig, name) {
    if (!isDevtoolsEnabled())
        return -1;
    // اگر قبلاً ثبت شده، همان ID را برگردان.
    const existingId = signalToId.get(sig);
    if (existingId !== undefined)
        return existingId;
    const id = nextSignalId++;
    const info = {
        id,
        name,
        value: sig.get(),
        subscriberCount: sig.subscriberCount,
        createdAt: Date.now(),
        signalRef: new WeakRef(sig),
    };
    signalToId.set(sig, id);
    idToInfo.set(id, info);
    // Bug Fix #5: ثبت در FinalizationRegistry برای پاکسازی خودکار.
    if (finalizationRegistry) {
        finalizationRegistry.register(sig, id);
    }
    return id;
}
/**
 * ثبت یک تغییر State در Timeline.
 */
export function recordStateChange(sig, oldValue, newValue) {
    if (!isDevtoolsEnabled())
        return;
    const id = signalToId.get(sig);
    if (id === undefined)
        return;
    const info = idToInfo.get(id);
    const change = {
        signalId: id,
        signalName: info?.name,
        oldValue,
        newValue,
        timestamp: Date.now(),
    };
    stateChangeTimeline.push(change);
    if (stateChangeTimeline.length > MAX_TIMELINE_SIZE) {
        stateChangeTimeline.shift();
    }
    if (info) {
        info.value = newValue;
        info.subscriberCount = sig.subscriberCount;
    }
    for (const listener of stateChangeListeners) {
        try {
            listener(change);
        }
        catch (err) {
            console.error('[Zenith DevTools] Error in state change listener:', err);
        }
    }
}
/**
 * دریافت لیست تمام Signal های فعال.
 *
 * Bug Fix #5: این تابع اکنون Signal های GC شده را فیلتر می‌کند.
 *
 * @returns آرایه‌ای از SignalInfo.
 */
export function getAllSignals() {
    if (!isDevtoolsEnabled())
        return [];
    // پاکسازی Signal های dispose شده قبل از بازگشت.
    cleanupDisposedSignals();
    return Array.from(idToInfo.values());
}
/**
 * دریافت Signal با ID.
 *
 * @param id ID Signal.
 * @returns SignalInfo یا undefined.
 */
export function getSignalInfo(id) {
    if (!isDevtoolsEnabled())
        return undefined;
    return idToInfo.get(id);
}
/**
 * دریافت Timeline تغییرات State.
 */
export function getStateTimeline(limit = 100) {
    if (!isDevtoolsEnabled())
        return [];
    return stateChangeTimeline.slice(-limit);
}
/**
 * ثبت یک callback برای تغییرات State.
 */
export function onStateChange(callback) {
    if (!isDevtoolsEnabled())
        return () => { };
    stateChangeListeners.push(callback);
    return () => {
        const idx = stateChangeListeners.indexOf(callback);
        if (idx >= 0)
            stateChangeListeners.splice(idx, 1);
    };
}
/**
 * پاکسازی Signal های dispose شده از رجیستری.
 *
 * Bug Fix #5: این تابع اکنون واقعاً کار می‌کند!
 *
 * قبلاً این تابع no-op بود چون SignalInfo شامل reference مستقیم به Signal بود
 * که Signal را زنده نگه می‌داشت. اکنون SignalInfo شامل WeakRef است، پس
 * اگر Signal ای GC شده باشد، `signalRef.deref()` برمی‌گرداند `undefined`
 * و ما آن را از idToInfo حذف می‌کنیم.
 *
 * نکته: FinalizationRegistry هم به‌طور خودکار این کار را می‌کند، اما
 * این تابع برای اطمینان از پاکسازی قبل از getAllSignals فراخوانی می‌شود.
 */
function cleanupDisposedSignals() {
    for (const [id, info] of idToInfo) {
        const sig = info.signalRef.deref();
        if (sig === undefined) {
            // Signal ای GC شده است. از idToInfo حذف کن.
            idToInfo.delete(id);
        }
    }
}
/**
 * پاکسازی کامل رجیستری (برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export function clearRegistry() {
    signalToId = new WeakMap();
    idToInfo.clear();
    stateChangeTimeline.length = 0;
    stateChangeListeners.length = 0;
    // FIX (v1.2.4): Do NOT reset `nextSignalId` here. Resetting it causes ID
    // collisions: signals created after a `clearRegistry()` call (e.g. between
    // test suites, or after a route change that re-initializes state) would
    // reuse IDs 1, 2, 3, ... that may still be referenced by:
    //   - State change timeline entries still held by external listeners.
    //   - DevTools panels that cached `SignalInfo` objects.
    //   - FinalizationRegistry callbacks (which fire async after GC).
    // Keeping the counter monotonically increasing guarantees global ID
    // uniqueness for the lifetime of the process.
    // nextSignalId = 1;
}
/**
 * نام‌گذاری یک Signal (برای دیباگ).
 */
export function nameSignal(sig, name) {
    if (!isDevtoolsEnabled())
        return;
    const id = signalToId.get(sig);
    if (id === undefined) {
        registerSignal(sig, name);
        return;
    }
    const info = idToInfo.get(id);
    if (info)
        info.name = name;
}
//# sourceMappingURL=registry.js.map