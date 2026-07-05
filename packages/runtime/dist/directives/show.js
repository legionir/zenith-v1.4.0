import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
export function processShow(el, expr, context) {
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
    const evalFn = compileExpression(expr);
    // FEATURE (v1.0.0): Property Diffing — اگر visible با قبلی برابر است، skip کن.
    let prevVisible = undefined;
    const dispose = effect(() => {
        try {
            const visible = Boolean(evalFn(context));
            if (prevVisible === visible)
                return;
            prevVisible = visible;
            el.style.display = visible ? '' : 'none';
        }
        catch (err) {
            reportError(err, 'expression', { expression: expr, element: el });
        }
    });
    return dispose;
}
//# sourceMappingURL=show.js.map
