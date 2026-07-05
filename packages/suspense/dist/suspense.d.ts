export interface SuspenseState {
    /** آیا در حال loading است؟ */
    loading: boolean;
    /** تعداد فرزندان در حال loading. */
    pendingCount: number;
}
/**
 * پردازش دایرکتیو zen-suspense.
 *
 * @param el              عنصر <zen-suspense>.
 * @param processChildren callback برای walk فرزندان.
 * @param disposes        آرایه‌ی dispose functions.
 */
export declare function processSuspense(el: HTMLElement, processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void, context: Record<string, any>, disposes: (() => void)[]): void;
