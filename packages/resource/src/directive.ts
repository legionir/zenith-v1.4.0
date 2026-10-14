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

// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { logger } from '@zenith/logger';
import { Resource } from './resource';

/**
 * پردازش دایرکتیو zen-resource.
 *
 * #116 cleanup protocol: خروجی یک `Cleanup` idempotent است؛ آرایهٔ
 * `disposes` هم برای سازگاری با گذشته پر می‌شود.
 */
export function processResource(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
  processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void,
  disposes: (() => void)[],
): () => void {
  const stateName = el.getAttribute('zen-state') || 'data';

  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);

  // ارزیابی URL.
  let url: string;
  try {
    url = evalFn(context);
  } catch (err) {
    logger.error(
      `[Zenith Resource] Failed to evaluate URL: ${err instanceof Error ? err.message : String(err)}`,
    );
    return () => {}; // #116: Cleanup no-op در مسیر خطا
  }

  // ساخت Resource.
  const resource = new Resource({ url });

  // ساخت context محلی.
  const localContext: Record<string, any> = Object.create(context);
  Object.defineProperty(localContext, `$${stateName}`, {
    get: () => resource.signal.get(),
    enumerable: true,
    configurable: true,
  });

  // Process فرزندان.
  const childDisposes: (() => void)[] = [];
  for (const child of Array.from(el.children)) {
    processChildren(child as HTMLElement, localContext, childDisposes);
  }

  // شروع fetch اولیه.
  void resource.list();

  // ثبت dispose (#116: Cleanup idempotent + آرایهٔ disposes برای سازگاری).
  const cleanup = (): void => {
    resource.dispose();
    for (const d of childDisposes) {
      try {
        d();
      } catch (err) {
        logger.error(
          `[Zenith Resource] Error during dispose: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    childDisposes.length = 0;
  };
  let cleaned = false;
  const idempotentCleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
  disposes.push(idempotentCleanup);
  return idempotentCleanup;
}
