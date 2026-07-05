import { Signal } from './signal';
/**
 * اطلاعات یک Signal در رجیستری.
 *
 * نکته: `signalRef` اکنون یک WeakRef است تا GC بتواند Signal های dispose
 * شده را به‌طور خودکار پاک کند. برای backward compatibility، `signal`
 * به‌عنوان یک getter که `signalRef.deref()` را برمی‌گرداند باقی مانده است.
 */
export interface SignalInfo {
    /** ID یکتای Signal. */
    id: number;
    /** نام Signal (اگر کاربر تعیین کرده باشد). */
    name?: string;
    /** مقدار فعلی. */
    value: any;
    /** تعداد subscribers (Effectهای وابسته). */
    subscriberCount: number;
    /** زمان ساخت (timestamp). */
    createdAt: number;
    /**
     * Reference ضعیف (Weak) به خود Signal.
     *
     * Bug Fix #5: قبلاً این فیلد مستقیماً Signal را نگه می‌داشت که باعث
     * memory leak می‌شد. اکنون WeakRef است تا GC بتواند Signal را پاک کند.
     *
     * برای دسترسی به Signal واقعی از `info.signalRef.deref()` استفاده کنید.
     * اگر Signal ای GC شده باشد، `deref()` برمی‌گرداند `undefined`.
     */
    signalRef: WeakRef<Signal<any>>;
}
/**
 * اطلاعات یک تغییر State (برای Timeline).
 */
export interface StateChange {
    /** ID Signal که تغییر کرده. */
    signalId: number;
    /** نام Signal (اگر موجود). */
    signalName?: string;
    /** مقدار قبلی. */
    oldValue: any;
    /** مقدار جدید. */
    newValue: any;
    /** زمان تغییر (timestamp). */
    timestamp: number;
    /** Stack trace (برای دیباگ). */
    stack?: string;
}
/**
 * ثبت یک Signal در رجیستری.
 *
 * @param sig  Signal که ساخته شده.
 * @param name نام اختیاری Signal (برای دیباگ).
 * @returns ID اختصاص داده شده به Signal.
 */
export declare function registerSignal(sig: Signal<any>, name?: string): number;
/**
 * ثبت یک تغییر State در Timeline.
 */
export declare function recordStateChange(sig: Signal<any>, oldValue: any, newValue: any): void;
/**
 * دریافت لیست تمام Signal های فعال.
 *
 * Bug Fix #5: این تابع اکنون Signal های GC شده را فیلتر می‌کند.
 *
 * @returns آرایه‌ای از SignalInfo.
 */
export declare function getAllSignals(): SignalInfo[];
/**
 * دریافت Signal با ID.
 *
 * @param id ID Signal.
 * @returns SignalInfo یا undefined.
 */
export declare function getSignalInfo(id: number): SignalInfo | undefined;
/**
 * دریافت Timeline تغییرات State.
 */
export declare function getStateTimeline(limit?: number): StateChange[];
/**
 * ثبت یک callback برای تغییرات State.
 */
export declare function onStateChange(callback: (change: StateChange) => void): () => void;
/**
 * پاکسازی کامل رجیستری (برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export declare function clearRegistry(): void;
/**
 * نام‌گذاری یک Signal (برای دیباگ).
 */
export declare function nameSignal(sig: Signal<any>, name: string): void;
//# sourceMappingURL=registry.d.ts.map