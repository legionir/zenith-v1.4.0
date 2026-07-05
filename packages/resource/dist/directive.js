// packages/resource/src/directive.ts
//
// دایرکتیو zen-resource — اتصال Resource به DOM.
//
// سینتکس:
//   <div zen-resource="'/api/users'" zen-state="users">
//     <div zen-if="$users.loading">Loading...</div>
//     <div zen-if="$users.error">Error!</div>
//     <ul>
//       <li zen-for="user in $users.data" zen-key="user.id">
//         <span zen-text="$user.name"></span>
//       </li>
//     </ul>
//   </div>
//
// این دایرکتیو:
//   1) یک Resource می‌سازد (یا از registry می‌گیرد).
//   2) Signal آن را به‌صورت $<stateName> در context محلی قرار می‌دهد.
//   3) بلافاصله list() را صدا می‌زند.
//   4) فرزندان را با context محلی walk می‌کند.
import { compileExpression } from '@zenith/expressions';
import { Resource } from './resource.js';
/**
 * پردازش دایرکتیو zen-resource.
 */
export function processResource(el, expr, context, processChildren, disposes) {
    const stateName = el.getAttribute('zen-state') || 'data';
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
    const evalFn = compileExpression(expr);
    // ارزیابی URL.
    let url;
    try {
        url = evalFn(context);
    }
    catch (err) {
        console.error(`[Zenith Resource] Failed to evaluate URL:`, err);
        return;
    }
    // ساخت Resource.
    const resource = new Resource({ url });
    // ساخت context محلی.
    const localContext = Object.create(context);
    Object.defineProperty(localContext, `$${stateName}`, {
        get: () => resource.signal.get(),
        enumerable: true,
        configurable: true,
    });
    // Process فرزندان.
    const childDisposes = [];
    for (const child of Array.from(el.children)) {
        processChildren(child, localContext, childDisposes);
    }
    // شروع fetch اولیه.
    resource.list();
    // ثبت dispose.
    disposes.push(() => {
        resource.reset();
        for (const d of childDisposes) {
            try {
                d();
            }
            catch (err) {
                console.error('[Zenith Resource] Error during dispose:', err);
            }
        }
        childDisposes.length = 0;
    });
}
//# sourceMappingURL=directive.js.map