import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import type { Walk } from './walk-types';
/** Branch-chain operands share the caller's live context and traversal. @internal */
export interface IfChainInput { expression: string; context: Record<string, unknown>; state: Record<string, unknown>; walk: Walk; }
/** Mount only the first matching branch, preserving placeholder and cleanup order. @internal */
export function processIfChain(ifEl: HTMLElement, input: IfChainInput): () => void {
  const { expression: ifExpr, context, state, walk } = input;
  // جمع‌آوری زنجیره
  const chain: Array<{ el: HTMLElement; expr: string | null }> = [{ el: ifEl, expr: ifExpr }];

  let next = ifEl.nextElementSibling as HTMLElement | null;
  while (next) {
    if (next.hasAttribute('zen-else-if')) {
      chain.push({ el: next, expr: next.getAttribute('zen-else-if') });
      next = next.nextElementSibling as HTMLElement | null;
    } else if (next.hasAttribute('zen-else')) {
      chain.push({ el: next, expr: null });
      break;
    } else {
      break;
    }
  }

  // compile همه expressions (یک‌بار)
  const evalFns = chain.map(({ expr }) => (expr ? compileExpression(expr) : () => true));

  // FIX (v1.2.8): P0-1 — برای هر branch یک Comment placeholder بساز و عنصر
  // را با آن جایگزین کن. عنصر در حافظه نگه داشته می‌شود؛ mountBranch آن را
  // قبل از placeholder درج می‌کند وقتی branch فعال شود.
  const placeholders: Comment[] = [];
  const parents: (HTMLElement | null)[] = [];
  for (const c of chain) {
    const parent = c.el.parentElement;
    parents.push(parent);
    const ph = document.createComment('zen-if-chain');
    placeholders.push(ph);
    if (parent) {
      parent.replaceChild(ph, c.el);
    }
  }

  // هر branch یک dispose bucket اختصاصی دارد — فقط branch فعال disposes زنده دارد.
  const branchDisposes: Array<Array<() => void>> = chain.map(() => []);

  function mountBranch(i: number): void {
    const c = chain[i]!;
    const ph = placeholders[i]!;
    const parent = parents[i];
    if (!parent) return;
    // درج مجدد عنصر قبل از placeholder
    parent.insertBefore(c.el, ph);
    // حذف attributeهای ساختاری تا walker دوباره وارد زنجیره نشود
    c.el.removeAttribute('zen-if');
    c.el.removeAttribute('zen-else-if');
    c.el.removeAttribute('zen-else');
    c.el.removeAttribute('data-zenith-else-handled');
    // walk این branch — disposes تازه در branchDisposes[i] ذخیره می‌شوند
    const disposes: (() => void)[] = [];
    walk(c.el, context, state, disposes);
    branchDisposes[i] = disposes;
  }

  function unmountBranch(i: number): void {
    const c = chain[i]!;
    const parent = parents[i];
    // ابتدا disposes فرزندان را اجرا کن
    const ds = branchDisposes[i]!;
    for (const d of ds) {
      try {
        d();
      } catch {
        /* یک dispose failure نباید بقیه را متوقف کند */
      }
    }
    branchDisposes[i] = [];
    // عنصر را از DOM حذف کن (placeholder باقی می‌ماند برای re-mount)
    if (parent && c.el.parentNode === parent) {
      parent.removeChild(c.el);
    }
  }

  let activeIndex = -1;

  const dispose = effect(() => {
    // انتخاب اولین branch با condition=true
    let newIndex = -1;
    for (let i = 0; i < chain.length; i++) {
      try {
        if (evalFns[i]!(context)) {
          newIndex = i;
          break;
        }
      } catch {
        // خطای expression در یک branch → treat as false، ادامه بده
      }
    }
    if (newIndex === activeIndex) return;
    // unmount branch قبلی (در صورت وجود)
    if (activeIndex !== -1) {
      unmountBranch(activeIndex);
    }
    // mount branch جدید (در صورت وجود)
    if (newIndex !== -1) {
      mountBranch(newIndex);
    }
    activeIndex = newIndex;
  });

  return () => {
    dispose();
    if (activeIndex !== -1) {
      unmountBranch(activeIndex);
      activeIndex = -1;
    }
    // حذف همه placeholderها
    for (let i = 0; i < placeholders.length; i++) {
      const ph = placeholders[i]!;
      const parent = parents[i];
      if (parent && ph.parentNode === parent) {
        parent.removeChild(ph);
      }
    }
  };
}
